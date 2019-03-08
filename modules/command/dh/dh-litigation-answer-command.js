const Command = require('../command');
const importUtilities = require('../../ImportUtilities');
const utilities = require('../../Utilities');
const models = require('../../../models/index');

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

        const holdingData = await models.holding_data.findAll({
            where: {
                data_set_id: dataSetId,
            },
        });

        if (holdingData.length === 0) {
            throw new Error(`Failed to find holding data for data set ${dataSetId}`);
        }

        const vertices = await this.graphStorage
            .findVerticesByImportId(dataSetId, holdingData[0].color);

        importUtilities.unpackKeys(vertices, []);
        const rawAnswer = this.challengeService.answerChallengeQuestion(blockId, vertices);
        const answer = utilities.normalizeHex(Buffer.from(rawAnswer, 'utf-8').toString('hex').padStart(64, '0'));

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
