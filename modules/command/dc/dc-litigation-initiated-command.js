const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether litigation is successfully initiated
 */
class DcLitigationInitiatedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            dhIdentity,
            blockId,
        } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'LitigationInitiated',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                    holderIdentity,
                    requestedDataIndex,
                } = JSON.parse(e.data);
                return Utilities.compareHexStrings(offerId, eventOfferId)
                    && Utilities.compareHexStrings(dhIdentity, holderIdentity)
                    && blockId === parseInt(requestedDataIndex, 10);
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                this.logger.important(`Litigation initiated for DH ${dhIdentity} and offer ${offerId}.`);

                const replicatedData = await Models.replicated_data.findOne({
                    where: { offer_id: offerId, dh_identity: dhIdentity },
                });
                replicatedData.status = 'LITIGATION_STARTED';
                await replicatedData.save({ fields: ['status'] });
                return Command.empty();
            }
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
            name: 'dcLitigationInitiatedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcLitigationInitiatedCommand;
