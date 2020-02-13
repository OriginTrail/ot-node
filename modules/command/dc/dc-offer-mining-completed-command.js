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
        this.profileService = ctx.profileService;
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
            handler_id,
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
            this.remoteControl.offerUpdate({
                offer_id: offerId,
            });

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

            if (this.config.parentIdentity) {
                const hasPermission = await this.profileService.hasParentPermission();
                if (!hasPermission) {
                    const message = 'Identity does not have permission to use parent identity funds. To replicate data please acquire permissions or remove parent identity from config';
                    this.logger.warn(message);
                    throw new Error(message);
                }

                const hasFunds = await
                this.dcService.parentHasProfileBalanceForOffer(offer.token_amount_per_holder);
                if (!hasFunds) {
                    const message = 'Parent profile does not have enough tokens. To replicate data please deposit more tokens to your profile';
                    this.logger.warn(message);
                    throw new Error(message);
                }
            } else {
                const hasFunds =
                    await this.dcService.hasProfileBalanceForOffer(offer.token_amount_per_holder);
                if (!hasFunds) {
                    const message = 'Not enough tokens. To replicate data please deposit more tokens to your profile';
                    this.logger.warn(message);
                    throw new Error(message);
                }
            }
            const commandData = {
                offerId, solution, handler_id, urgent: offer.urgent,
            };
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
        this.remoteControl.offerUpdate({
            offer_id: offerId,
        });
        models.handler_ids.update({
            status: 'FAILED',
        }, { where: { handler_id } });

        await this.replicationService.cleanup(offer.id);
        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { offerId, handler_id } = command.data;
        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message', 'global_status'] });
        this.remoteControl.offerUpdate({
            offer_id: offerId,
        });
        models.handler_ids.update({
            status: 'FAILED',
        }, { where: { handler_id } });

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
