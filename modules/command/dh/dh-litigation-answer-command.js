const Command = require('../command');
const importUtilities = require('../../ImportUtilities');
const utilities = require('../../Utilities');

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
        this.challengeService = ctx.challengeService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            blockId,
            dataSetId,
        } = command.data;

        const vertices = await this.graphStorage.findVerticesByImportId(dataSetId, true);
        importUtilities.unpackKeys(vertices, []);
        const answer = utilities.normalizeHex(Buffer.from(this.challengeService.answerChallengeQuestion(blockId, vertices), 'utf-8').toString('hex'));
        this.logger.important(`Answering litigation for offer ${offerId} and blockId ${blockId}. Answer: ${answer}`);

        const dhIdentity = utilities.normalizeHex(this.config.erc725Identity);
        await this.blockchain.answerLitigation(offerId, dhIdentity, answer);
        return {
            commands: [
                {
                    name: 'dhLitigationAnsweredCommand',
                    data: {
                        offerId,
                        dhIdentity,
                    },
                    period: 5000,
                    transactional: false,
                },
            ],
        };
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
