const Command = require('../command');
const models = require('../../../models/index');
const utilities = require('../../Utilities');

/**
 * Listens indefinitely for REPLACEMENT_STARTED event from blockchain
 */
class DHReplacementStartedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.dhService = ctx.dhService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        try {
            const event = await models.events.findOne({
                limit: 1,
                where: {
                    event: 'ReplacementStarted',
                    finished: 0,
                },
            });

            if (event) {
                const {
                    offerId,
                    holderIdentity,
                    challengerIdentity,
                    litigationRootHash,
                } = JSON.parse(event.data);

                if (utilities.compareHexStrings(this.config.erc725Identity, challengerIdentity)) {
                    return Command.repeat();
                }

                this.logger.info(`Replacement triggered for offer ${offerId}. Litigator ${challengerIdentity}.`);

                event.finished = true;
                await event.save({ fields: ['finished'] });

                const mine = await this._checkIfMineReplacement(offerId);
                if (mine) {
                    return Command.repeat();
                }

                await this.dhService.handleReplacement(
                    offerId, challengerIdentity, holderIdentity,
                    litigationRootHash,
                );
            }
        } catch (e) {
            this.logger.error(`Failed to process ReplacementStartedCommand command. ${e.message}.\n${e.stack}`);
        }

        return Command.repeat();
    }

    /**
     * Check if I've been penalized
     * @param offerId
     * @return {Promise<Boolean>}
     * @private
     */
    async _checkIfMineReplacement(offerId) {
        const events = await models.events.findAll({
            where: {
                event: 'LitigationCompleted',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                    holderIdentity,
                } = JSON.parse(e.data);
                return utilities.compareHexStrings(offerId, eventOfferId)
                    && utilities.compareHexStrings(this.config.erc725Identity, holderIdentity);
            });

            if (event != null) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                const {
                    DH_was_penalized: penalized,
                } = JSON.parse(event.data);

                const bid = await models.bids.findOne({
                    where: {
                        offer_id: offerId,
                    },
                });

                if (penalized) {
                    this.logger.warn(`I've been penalized for offer ${offerId}`);
                    bid.status = 'PENALIZED';
                } else {
                    this.logger.warn(`I haven't been penalized for offer ${offerId}`);
                    bid.status = 'CHOSEN';
                }
                await bid.save({ fields: ['status'] });
                return true;
            }
        }
        return false;
    }

    /**
     * Builds default DHReplacementStartedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhReplacementStartedCommand',
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

module.exports = DHReplacementStartedCommand;
