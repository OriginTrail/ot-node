const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

/**
 * Initiates litigation completion from the DC side
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

        const dcIdentity = utilities.normalizeHex(this.config.erc725Identity);

        const challenge = await models.challenges.findOne({
            where:
                {
                    dh_identity: dhIdentity,
                    block_id: blockId,
                    offer_id: offerId,
                },
        });

        const answer = utilities.normalizeHex(Buffer.from(challenge.answer, 'utf-8').toString('hex'));
        await this.blockchain.completeLitigation(offerId, dhIdentity, dcIdentity, answer);
        return Command.empty();
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
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCLitigationCompleteCommand;
