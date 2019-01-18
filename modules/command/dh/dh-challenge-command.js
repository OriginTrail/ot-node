const Command = require('../command');
const importUtilities = require('../../ImportUtilities');
const models = require('../../../models/index');

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

        const holdingData = await models.holding_data.findOne({
            limit: 1,
            where: {
                data_set_id: datasetId,

            },
            order: [
                ['id', 'DESC'],
            ],
        });

        if (holdingData == null) {
            throw new Error(`Failed to find holding data for data set ${datasetId}`);
        }

        const vertices = await this.graphStorage
            .findVerticesByImportId(datasetId, holdingData.color);
        importUtilities.unpackKeys(vertices, []);
        const answer = this.challengeService.answerChallengeQuestion(blockId, vertices);

        this.logger.info(`Calculated answer for dataset ${datasetId}, color ${holdingData.color} and block ${blockId} is ${answer}`);
        await this.transport.challengeResponse({
            payload: {
                answer,
                challenge_id: challengeId,
            },
        }, litigatorNodeId);

        this.logger.info(`Challenge answer ${answer} sent to ${litigatorNodeId}.`);
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
