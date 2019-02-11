const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

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
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            offerId,
            dhIdentity,
            blockId,
        } = command.data;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        if (offer.global_status === 'COMPLETED') {
            // offer has already been completed
            this.logger.warn(`Offer ${offerId} has already been completed. Skipping litigation for DH identity ${dhIdentity} and block ${blockId}`);
            return Command.empty();
        }

        const dcIdentity = utilities.normalizeHex(this.config.erc725Identity);

        const challenge = await models.challenges.findOne({
            where:
                {
                    dh_identity: dhIdentity,
                    block_id: blockId,
                    offer_id: offerId,
                },
        });

        const answer = utilities.normalizeHex(Buffer.from(challenge.expected_answer, 'utf-8').toString('hex').padStart(64, '0'));
        await this.blockchain.completeLitigation(offerId, dhIdentity, dcIdentity, answer);
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
