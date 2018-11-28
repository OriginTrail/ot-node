const Command = require('../command');
const importUtilities = require('../../ImportUtilities');
const utilities = require('../../Utilities');

/**
 * Repeatable command that checks whether litigation is successfully initiated
 */
class DHLitigationInitiatedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.replicationService = ctx.replicationService;
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
        const answer = this.challengeService.answerChallengeQuestion(blockId, vertices);
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

module.exports = DHLitigationInitiatedCommand;
