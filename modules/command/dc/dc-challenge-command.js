const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const constants = require('../../utility/constants');
const importUtilities = require('../../ImportUtilities');

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
            dhId,
            dhIdentity,
            offerId,
            dataSetId,
            litigationPrivateKey,
        } = command.data;

        await models.replicated_data.update(
            {
                status: 'CHALLENGING',
            },
            {
                where: {
                    offer_id: offerId,
                    dh_identity: dhIdentity,
                },
            },
        );

        const numberOfTests = constants.DEFAULT_CHALLENGE_NUMBER_OF_TESTS;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        const vertices = await this.graphStorage.findVerticesByImportId(offer.data_set_id);

        const encryptedVertices = importUtilities.immutableEncryptVertices(
            vertices,
            litigationPrivateKey,
        );
        const challenges = this.challengeService.generateChallenges(
            numberOfTests,
            constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
            encryptedVertices,
        );
        const challenge = challenges[utilities.getRandomInt(numberOfTests - 1)];

        this.logger.trace(`Sending challenge to ${dhId}. Import ID ${dataSetId}, block ID ${challenge.block_id}.`);

        const currentTime = new Date().getTime();
        const challengeRecord = await models.challenges.create({
            dh_id: dhId,
            dh_identity: dhIdentity,
            data_set_id: offer.data_set_id,
            block_id: challenge.block_id,
            expected_answer: challenge.answer,
            start_time: currentTime,
            offer_id: offerId,
            end_time: currentTime + constants.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS,
        });

        await this.transport.challengeRequest({
            payload: {
                data_set_id: offer.data_set_id,
                block_id: challenge.block_id,
                challenge_id: challengeRecord.id,
                litigator_id: this.config.identity,
            },
        }, dhId);

        return {
            commands: [
                {
                    name: 'dcChallengeCheckCommand',
                    delay: constants.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS,
                    data: {
                        dhId,
                        dhIdentity,
                        offerId,
                        dataSetId,
                        litigationPrivateKey,
                        challengeId: challengeRecord.id,
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
