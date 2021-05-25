const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Repeatable command that checks whether offer is created or litigation is successfully initiated
 */
class DHProcessBlockchainEventsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.blockchain = ctx.blockchain;
        this.profileService = ctx.profileService;
        this.errorNotificationService = ctx.errorNotificationService;
        this.dhService = ctx.dhService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        try {
            const events = await Models.events.findAll({
                where: {
                    event: {
                        [Models.Sequelize.Op.in]: [
                            constants.EVENT_NAME.LitigationInitiated,
                            constants.EVENT_NAME.OfferCreated],
                    },
                    finished: 0,
                },
            });
            if (events) {
                const litigationInitiatedEvents = events
                    .filter(e => e.event === constants.EVENT_NAME.LitigationInitiated);

                const offerCreatedEvents = events
                    .filter(e => e.event === constants.EVENT_NAME.OfferCreated);

                await this.handleLitigationInitiatedEvents(litigationInitiatedEvents);

                await this.handleOfferCreatedEvents(offerCreatedEvents);
            }
        } catch (e) {
            this.logger.error(`Failed to process dhProcessBlockchainEventsCommand. ${e}`);
            this.errorNotificationService.notifyError(
                e,
                null,
                constants.PROCESS_NAME.bcEventsHandling,
            );
        }

        return Command.repeat();
    }

    async handleLitigationInitiatedEvents(events) {
        const allMyIdentities = {};
        this.blockchain.getAllBlockchainIds()
            .forEach(id => allMyIdentities[id] = this.profileService.getIdentity(id));
        const event = events.find((e) => {
            const {
                holderIdentity,
            } = JSON.parse(e.data);

            return Utilities.compareHexStrings(
                holderIdentity,
                allMyIdentities[e.blockchain_id],
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

    async handleOfferCreatedEvents(events) {
        let offerData = {};
        let dcNodeId = '';
        const event = events.find(async (e) => {
            offerData = JSON.parse(e.data);
            dcNodeId = Utilities.denormalizeHex(offerData.dcNodeId).substring(24);

            if (Utilities.compareHexStrings(this.config.identity, dcNodeId)) {
                e.finished = 1;
                await e.save();
                return false; // the offer is mine
            }
            return true;
        });

        if (event) {
            event.finished = 1;
            await event.save();

            try {
                this.logger.notify(`Offer ${offerData.offerId} has been created by ${dcNodeId} on blockchain ${event.blockchain_id}.`);
                await this.dhService.handleOffer(
                    offerData.offerId,
                    dcNodeId,
                    offerData.dataSetSizeInBytes,
                    offerData.holdingTimeInMinutes,
                    offerData.litigationIntervalInMinutes,
                    offerData.tokenAmountPerHolder,
                    offerData.dataSetId,
                    event.blockchain_id,
                );
            } catch (e) {
                this.logger.warn(e.message);
            }
        }
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhProcessBlockchainEventsCommand',
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

module.exports = DHProcessBlockchainEventsCommand;
