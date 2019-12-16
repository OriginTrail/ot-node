const Command = require('../command');
const models = require('../../../models/index');
const constants = require('../../constants');

/**
 *  Challenges one DH
 */
class DCChallengeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            challenge_id,
            litigationPrivateKey,
        } = command.data;

        const challenge = await models.challenges.findOne({
            where: {
                id: challenge_id,
            },
        });

        this.logger.trace(`Sending challenge to ${challenge.dh_id}. Offer ID ${challenge.offer_id}, object_index ${challenge.object_index}, block_index ${challenge.block_index}.`);

        challenge.end_time = new Date().getTime() + constants.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS;

        try {
            await this.transport.challengeRequest({
                payload: {
                    offer_id: challenge.offer_id,
                    data_set_id: challenge.data_set_id,
                    object_index: challenge.object_index,
                    block_index: challenge.block_index,
                    challenge_id: challenge.id,
                    litigator_id: this.config.identity,
                },
            }, challenge.dh_id);
        } catch (e) {
            this.logger.info(`Peer with ID ${challenge.dh_id} could not be reached.`);
        }

        const checkCommandDelay = constants.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS;

        return {
            commands: [
                {
                    name: 'dcChallengeCheckCommand',
                    delay: checkCommandDelay,
                    data: {
                        dhId: challenge.dh_id,
                        dhIdentity: challenge.dh_identity,
                        offerId: challenge.offer_id,
                        dataSetId: challenge.data_set_id,
                        litigationPrivateKey,
                        challengeId: challenge.id,
                    },
                    transactional: false,
                },
            ],
        };
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            challenge_id,
            litigationPrivateKey,
        } = command.data;

        const challenge = await models.challenges.findOne({
            where: {
                id: challenge_id,
            },
        });

        if (challenge == null) {
            throw new Error(`Failed to find challenge ${challenge_id}`);
        }

        this.logger.info(`Failed to send challenge for object ${challenge.object_index} and block ${challenge.block_index} to DH ${challenge.dh_id}.`);
        return {
            commands: [
                {
                    name: 'dcLitigationInitiateCommand',
                    period: 5000,
                    data: {
                        offerId: challenge.offer_id,
                        objectIndex: challenge.object_index,
                        blockIndex: challenge.block_index,
                        dhIdentity: challenge.dh_identity,
                        litigationPrivateKey,
                    },
                },
            ],
        };
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            name: 'dcChallengeCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCChallengeCommand;
