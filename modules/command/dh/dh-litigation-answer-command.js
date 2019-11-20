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
        this.importService = ctx.importService;
        this.replicationService = ctx.replicationService;
        this.challengeService = ctx.challengeService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            objectIndex,
            blockIndex,
            dataSetId,
        } = command.data;

        const holdingData = await models.holding_data.findOne({
            where: {
                offer_id: offerId,
            },
        });

        if (holdingData == null) {
            throw new Error(`Failed to find holding data for offer ${offerId}`);
        }

        const color = this.replicationService.castNumberToColor(holdingData.color);

        const otObject = await this.importService.getImportedOtObject(
            dataSetId,
            objectIndex,
            offerId,
            color,
        );

        const answer = this.challengeService.answerChallengeQuestion(blockIndex, otObject);
        const rawAnswer = utilities.normalizeHex(Buffer.from(answer, 'utf-8').toString('hex').padStart(64, '0'));

        this.logger.info(`Calculated answer for offer ${offerId}, color ${color}, object index ${objectIndex}, and block index ${blockIndex} is ${answer}`);

        const dhIdentity = utilities.normalizeHex(this.config.erc725Identity);
        await this.blockchain.answerLitigation(offerId, dhIdentity, rawAnswer);
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
