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
            isReplacement,
        } = command.data;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        if (success) {
            this.logger.important(`Miner found a solution of offer ${offerId}.`);

            let excludedDHs = await this.dcService.checkDhFunds(
                solution.nodeIdentifiers,
                offer.token_amount_per_holder,
            );
            if (excludedDHs.length > 0) {
                // send back to miner
                this.logger.important(`DHs [${excludedDHs}] don't have enough funds for offer ${offerId}. Sending back to miner...`);
                const { data } = command;

                if (command.data.excludedDHs != null) {
                    excludedDHs = excludedDHs.concat(command.data.excludedDHs);
                }
                Object.assign(data, {
                    excludedDHs,
                    internalOfferId: offer.id,
                });
                return {
                    commands: [{
                        name: 'dcOfferChooseCommand',
                        data,
                    }],
                };
            }

            offer.status = 'MINED';
            offer.message = 'Found a solution for DHs provided';
            await offer.save({ fields: ['status', 'message'] });

            if (isReplacement) {
                return {
                    commands: [
                        {
                            name: 'dcOfferReplaceCommand',
                            data: command.data,
                        },
                    ],
                };
            }

            const hasFunds = await this.dcService
                .hasProfileBalanceForOffer(offer.token_amount_per_holder);
            if (!hasFunds) {
                throw new Error('Not enough tokens. To replicate data please deposit more tokens to your profile');
            }

            const commandData = { offerId, solution };
            const commandSequence = ['dcOfferFinalizeCommand'];
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
        this.logger.warn(`Offer ${offer.offer_id} has no solution.`);

        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = 'Failed to find solution for DHs provided';
        await offer.save({ fields: ['status', 'message', 'global_status'] });

        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { offerId } = command.data;
        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message', 'global_status'] });

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
