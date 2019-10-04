const Command = require('../command');
const importUtilities = require('../../ImportUtilities');
const models = require('../../../models/index');
const importUtilitites = require('../../ImportUtilities');

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
        this.otJsonImporter = ctx.otJsonImporter;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            objectIndex,
            blockIndex,
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
        // async getImport(datasetId, encColor = null)
        const document = this.otJsonImporter.getImport(datasetId, holdingData.color);
        // const vertices = await this.graphStorage
        //     .findVerticesByImportId(datasetId, holdingData.color);

        // const encryptedVertices = importUtilitites.immutableEncryptVertices(
        //     vertices,
        //     replicatedData.litigation_private_key,
        // );

        const answer = this.challengeService.answerChallengeQuestion(blockIndex, document['@graph'][objectIndex].data);

        this.logger.info(`Calculated answer for dataset ${datasetId}, color ${holdingData.color} object index ${objectIndex} and block index ${blockIndex} is ${answer}`);
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
