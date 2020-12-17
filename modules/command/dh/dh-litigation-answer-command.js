const Command = require('../command');
const importUtilities = require('../../ImportUtilities');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Repeatable command that checks whether litigation is successfully initiated
 */
class DHLitigationAnswerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.importService = ctx.importService;
        this.replicationService = ctx.replicationService;
        this.challengeService = ctx.challengeService;
        this.errorNotificationService = ctx.errorNotificationService;
        this.profileService = ctx.profileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            blockchain_id,
            objectIndex,
            blockIndex,
        } = command.data;

        const holdingData = await models.holding_data.findOne({
            where: {
                offer_id: offerId,
            },
        });

        if (holdingData == null) {
            throw new Error(`Failed to find holding data for offer ${offerId}`);
        }

        const dhIdentity = this.profileService.getIdentity(blockchain_id);
        const { status, timestamp } =
            await this.blockchain.getLitigation(offerId, dhIdentity, blockchain_id).response;

        const { litigation_interval_in_minutes } = await models.bids.findOne({
            where: {
                offer_id: offerId,
            },
        });

        const litigationTimestamp = parseInt(timestamp, 10) * 1000; // seconds -> miliseconds

        if (status === '1') {
            if (litigationTimestamp + (litigation_interval_in_minutes * 60 * 1000) >= Date.now()) {
                const color = this.replicationService.castNumberToColor(holdingData.color);

                const otObject = await this.importService.getImportedOtObject(
                    holdingData.data_set_id,
                    objectIndex,
                    offerId,
                    color,
                );

                const answer = this.challengeService.answerChallengeQuestion(blockIndex, otObject);
                const rawAnswer = utilities.normalizeHex(Buffer.from(answer, 'utf-8').toString('hex').padStart(64, '0'));

                this.logger.info(`Calculated answer for offer ${offerId}, color ${color}, object index ${objectIndex}, and block index ${blockIndex} is ${answer}`);

                await this.blockchain
                    .answerLitigation(offerId, dhIdentity, rawAnswer, true, blockchain_id).response;

                return {
                    commands: [
                        {
                            name: 'dhLitigationAnsweredCommand',
                            data: {
                                offerId,
                                blockchain_id,
                                dhIdentity,
                            },
                            period: 5000,
                            transactional: false,
                        },
                    ],
                };
            }
            this.logger.info(`It's too late to answer litigation for offer ${offerId}`);
        } else if (status === '2') {
            this.logger.info(`Litigation already answered for offer ${offerId}.`);
        } else if (status === '3' || status === '4') {
            await models.bids.update(
                {
                    status: 'PENALIZED',
                },
                {
                    where: { offer_id: offerId },
                },
            );
            this.logger.info(`I've already been penalized for offer ${offerId}`);
        } else {
            if (command.retries) {
                this.logger.trace(`Litigation status for offer ${offerId} unclear, checking status again after delay.`);
            } else {
                this.logger.trace(`Litigation for offer ${offerId} is not in progress.`);
            }
            command.delay = constants.BLOCKCHAIN_RETRY_DELAY_IN_MILLS;
            return Command.retry();
        }

        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            offerId,
            objectIndex,
            blockIndex,
        } = command.data;

        this.logger.error(`Failed to answer to litigation for offerId: ${offerId}`);

        this.errorNotificationService.notifyError(
            err,
            {
                objectIndex,
                blockIndex,
                offerId,
            },
            constants.PROCESS_NAME.litigationHandling,
        );

        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            name: 'dhLitigationAnswerCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHLitigationAnswerCommand;
