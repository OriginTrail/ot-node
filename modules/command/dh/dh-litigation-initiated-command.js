const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Repeatable command that checks whether litigation is successfully initiated
 */
class DHLitigationInitiatedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.blockchain = ctx.blockchain;
        this.profileService = ctx.profileService;
        this.errorNotificationService = ctx.errorNotificationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        try {
            const events = await Models.events.findAll({
                where: {
                    event: 'LitigationInitiated',
                    finished: 0,
                },
            });
            if (events) {
                const event = events.find((e) => {
                    const {
                        holderIdentity,
                    } = JSON.parse(e.data);

                    return Utilities.compareHexStrings(
                        holderIdentity,
                        this.profileService.getIdentity(e.blockchain_id),
                    );
                });
                if (event) {
                    event.finished = 1;
                    await event.save({ fields: ['finished'] });

                    const {
                        offerId,
                        requestedObjectIndex,
                        requestedBlockIndex,
                    } = JSON.parse(event.data);

                    this.logger.warn(`Litigation initiated for offer ${offerId}, object index ${requestedObjectIndex} and block index ${requestedBlockIndex}.`);

                    await this.commandExecutor.add({
                        name: 'dhLitigationAnswerCommand',
                        data: {
                            offerId,
                            blockchain_id: event.blockchain_id,
                            objectIndex: requestedObjectIndex,
                            blockIndex: requestedBlockIndex,
                        },
                        retries: constants.ANSWER_LITIGATION_COMMAND_RETRIES,
                    });
                }
            }
        } catch (e) {
            this.logger.error(`Failed to process dhLitigationInitiatedCommand. ${e}`);
            this.errorNotificationService.notifyError(
                e,
                null,
                constants.PROCESS_NAME.litigationHandling,
            );
        }

        return Command.repeat();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhLitigationInitiatedCommand',
            data: {
            },
            delay: 0,
            period: 5000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHLitigationInitiatedCommand;
