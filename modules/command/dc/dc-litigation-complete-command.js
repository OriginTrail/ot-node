const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Completes litigation from the DC side
 */
class DCLitigationCompleteCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
        this.errorNotificationService = ctx.errorNotificationService;
        this.profileService = ctx.profileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            offerId,
            blockchain_id,
            dhIdentity,
            blockIndex,
            objectIndex,
        } = command.data;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        if (offer.global_status === 'COMPLETED') {
            // offer has already been completed
            this.logger.warn(`Offer ${offerId} has already been completed. Skipping litigation for DH identity ${dhIdentity} with objectIndex ${objectIndex} and blockIndex ${blockIndex}`);
            return Command.empty();
        }

        if (offer.global_status === 'FAILED') {
            // offer has already been failed
            this.logger.warn(`Offer ${offerId} has already been failed. Skipping litigation for DH identity ${dhIdentity} with objectIndex ${objectIndex} and blockIndex ${blockIndex}`);
            return Command.empty();
        }

        const dcIdentity = this.profileService.getIdentity(blockchain_id);

        const challenge = await models.challenges.findOne({
            where:
                {
                    dh_identity: dhIdentity,
                    block_index: blockIndex,
                    object_index: objectIndex,
                    offer_id: offerId,
                },
        });

        const answer = utilities.normalizeHex(Buffer.from(challenge.expected_answer, 'utf-8').toString('hex').padStart(64, '0'));
        await this.blockchain.completeLitigation(
            offerId,
            dhIdentity,
            dcIdentity,
            answer,
            challenge.test_index,
            true,
            blockchain_id,
        ).response;
        return {
            commands: [
                {
                    name: 'dcLitigationCompletedCommand',
                    data: {
                        offerId,
                        dhIdentity,
                    },
                    period: 5000,
                    deadline_at: Date.now() + (5 * 60 * 1000),
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
            offerId,
            dhIdentity,
            objectIndex,
            blockIndex,
        } = command.data;

        this.logger.error(`Initiating complete command for holder ${dhIdentity} and offer ${offerId} FAILED!`);

        this.errorNotificationService.notifyError(
            err,
            {
                objectIndex,
                blockIndex,
                dhIdentity,
                offerId,
            },
            constants.PROCESS_NAME.litigationHandling,
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
            name: 'dcLitigationCompleteCommand',
            retries: 3,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCLitigationCompleteCommand;
