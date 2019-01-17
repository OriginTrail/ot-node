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

        this.logger.trace(`Sending challenge to ${challenge.dh_id}. Offer ID ${challenge.offer_id}, block ID ${challenge.block_id}.`);

        challenge.end_time = new Date().getTime() + constants.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS;

        await this.transport.challengeRequest({
            payload: {
                data_set_id: challenge.data_set_id,
                block_id: challenge.block_id,
                challenge_id: challenge.id,
                litigator_id: this.config.identity,
            },
        }, challenge.dh_id);

        return {
            commands: [
                {
                    name: 'dcChallengeCheckCommand',
                    delay: constants.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS,
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
            dhId,
            dhIdentity,
            offerId,
            litigationPrivateKey,
        } = command.data;

        const challenge = await models.challenges.findOne({
            where: {
                dh_id: dhId,
                offer_id: offerId,
            },
        });

        if (challenge == null) {
            this.logger.warn(`Failed to create challenge for DH ${dhId} and offer ${offerId}`);
            return Command.empty();
        }

        this.logger.info(`Failed to send challenge '${challenge.answer} to DH ${challenge.dh_id}.'`);
        return {
            commands: [
                {
                    name: 'dcLitigationInitiateCommand',
                    period: 5000,
                    data: {
                        offerId,
                        blockId: challenge.block_id,
                        dhIdentity,
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
