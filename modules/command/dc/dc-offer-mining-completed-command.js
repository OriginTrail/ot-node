const BN = require('../../../node_modules/bn.js/lib/bn');
const Command = require('../command');
const models = require('../../../models/index');

/**
 * Handles miner results
 */
class DcOfferMiningCompletedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.dcService = ctx.dcService;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            solution,
            success,
        } = command.data;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        if (success) {
            this.logger.important(`Miner found a solution of offer ${offerId}.`);

            const excludedDHs = await this.dcService.checkDhFunds(
                solution.nodeIdentifiers,
                offer.token_amount_per_holder,
            );
            if (excludedDHs.length > 0) {
                // send back to miner
                this.logger.important(`DHs [${excludedDHs}] don't have enough funds for offer ${offerId}. Sending back to miner...`);
                const { data } = command;
                Object.assign(data, {
                    excludedDHs,
                    internalOfferId: offer.id,
                });
                return {
                    commands: [{
                        name: 'dcOfferChooseCommand',
                        data,
                        transactional: false,
                    }],
                };
            }

            offer.status = 'MINED';
            offer.message = 'Found a solution for DHs provided';
            await offer.save({ fields: ['status', 'message'] });

            const commandData = { offerId, solution };
            const commandSequence = ['dcOfferFinalizeCommand'];
            const depositCommand = await this.dcService.chainDepositCommandIfNeeded(
                offer.token_amount_per_holder,
                commandData,
                commandSequence,
            );
            if (depositCommand) {
                return {
                    commands: [depositCommand],
                };
            }
            return {
                commands: [
                    {
                        name: commandSequence[0],
                        data: commandData,
                    },
                ],
            };
        }
        // TODO found no solution, handle this case properly
        this.logger.warn(`Offer with ID ${offerId} has no solution.`);

        offer.status = 'FAILED';
        offer.message = 'Failed to find solution for DHs provided';
        await offer.save({ fields: ['status', 'message'] });

        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferMiningCompletedCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcOfferMiningCompletedCommand;
