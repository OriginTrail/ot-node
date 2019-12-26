const Command = require('../command');
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
        this.replicationService = ctx.replicationService;
        this.importService = ctx.importService;
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
            offerId,
            challengeId,
            litigatorNodeId,
        } = command.data;

        const holdingData = await models.holding_data.findOne({
            where: {
                offer_id: offerId,
            },
        });

        if (holdingData == null) {
            command.retries = 0;
            throw new Error(`Failed to find holding data for offer ${offerId}`);
        }

        const color = this.replicationService.castNumberToColor(holdingData.color);

        const otObject = await this.importService.getImportedOtObject(
            datasetId,
            objectIndex,
            offerId,
            color,
        );
        const answer = this.challengeService.answerChallengeQuestion(blockIndex, otObject);

        this.logger.info(`Calculated answer for dataset ${datasetId}, color ${color}, object index ${objectIndex}, and block index ${blockIndex} is ${answer}`);
        try {
            await this.transport.challengeResponse({
                payload: {
                    answer,
                    challenge_id: challengeId,
                },
            }, litigatorNodeId);
        } catch (e) {
            command.delay = 60000;
            throw new Error(`Failed to send challenge response to litigator with ID ${litigatorNodeId} on attempt ${5 - command.retries}`);
        }

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
