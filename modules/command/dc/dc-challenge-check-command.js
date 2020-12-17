const Command = require('../command');
const models = require('../../../models');
const constants = require('../../constants');

/**
 *  Checks one DH's challenge response
 */
class DCChallengeCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
        this.config = ctx.config;
        this.errorNotificationService = ctx.errorNotificationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            dhId,
            challengeId,
            offerId,
            dhIdentity,
            litigationPrivateKey,
        } = command.data;

        const challenge = await models.challenges.findOne({ where: { id: challengeId } });

        if (!challenge) {
            return Command.empty();
        }

        const replicatedData = await models.replicated_data.findOne({
            where:
                {
                    offer_id: offerId, dh_id: dhId,
                },
        });

        if (!replicatedData) {
            return Command.empty();
        }

        if (challenge.answer === challenge.expected_answer) {
            this.logger.trace(`Holder ${dhIdentity} successfully answered to challenge for offer ${offerId}.`);

            replicatedData.status = 'HOLDING';
            await replicatedData.save({ fields: ['status'] });

            challenge.status = 'SUCCESSFUL';
            await challenge.save({ fields: ['status'] });
            return Command.empty();
        }
        if (this.config.send_challenges_log) {
            let notificationMessage = 'Challenge check failed. Initiating litigation. ';
            if (!challenge || !challenge.answer) {
                notificationMessage = `${notificationMessage}No answer from challenged Node!`;
            } else {
                notificationMessage = `${notificationMessage}Node responded with wrong answer!`;
            }
            this.errorNotificationService.notifyInfo(
                notificationMessage, {
                    id: challenge.dh_id,
                    dc_identity: this.config.identity,
                    dh_identity: dhIdentity,
                    challenge_id: challenge.id,
                    data_set_id: challenge.data_set_id,
                    object_index: challenge.object_index,
                    block_index: challenge.block_index,
                    expected_answer: challenge.expected_answer,
                    answer: challenge.answer,
                },
                constants.PROCESS_NAME.challengesHandling,
            );
        }
        this.logger.info(`Wrong answer to challenge '${challenge.id}' for DH ID ${challenge.dh_id}. Got ${challenge.answer} for expected answer ${challenge.expected_answer}.`);
        return {
            commands: [
                {
                    name: 'dcLitigationInitiateCommand',
                    period: 5000,
                    data: {
                        offerId,
                        blockchain_id: challenge.blockchain_id,
                        objectIndex: challenge.object_index,
                        blockIndex: challenge.block_index,
                        dhIdentity,
                        litigationPrivateKey,
                    },
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
            challengeId,
        } = command.data;

        const challenge = await models.challenges.findOne({
            where: {
                id: challengeId,
            },
        });

        if (challenge == null) {
            throw new Error(`Failed to find challenge ${challengeId}`);
        }
        const errorMessage = `Failed to check challenges for object ${challenge.object_index} and block ${challenge.block_index} to DH ${challenge.dh_identity}.`;
        this.logger.info(errorMessage);
        this.errorNotificationService.notifyError(
            errorMessage,
            {
                objectIndex: challenge.object_index,
                blockIndex: challenge.block_index,
                dhIdentity: challenge.dh_identity,
                offerId: challenge.offer_id,
                datasetId: challenge.data_set_id,
            },
            constants.PROCESS_NAME.challengesHandling,
        );
        return Command.retry();
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
            name: 'dcChallengeCheckCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCChallengeCheckCommand;
