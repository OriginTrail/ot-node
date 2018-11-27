const Command = require('../command');
const importUtilities = require('../../ImportUtilities');

/**
 * Handles one data challenge
 */
class DHChallengeCommand extends Command {
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
     * @param command
     */
    async execute(command) {
        const {
            blockId,
            datasetId,
            challengeId,
            litigatorNodeId,
        } = command.data;

        const vertices = await this.graphStorage.findVerticesByImportId(datasetId, true);
        importUtilities.unpackKeys(vertices, []);
        const answer = this.challengeService.answerChallengeQuestion(blockId, vertices);
        this.logger.trace(`Sending answer to question for data set ID ${datasetId}, block ID ${blockId}. Block ${answer}`);

        await this.transport.challengeResponse({
            payload: {
                answer,
                challenge_id: challengeId,
            },
        }, litigatorNodeId);
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhChallengeCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHChallengeCommand;
