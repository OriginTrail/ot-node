const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');

const Models = require('../../../models/index');

const { Op } = Models.Sequelize;


/**
 * Finalizes offer on blockchain
 */
class DCOfferFinalizeCommand extends Command {
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
        } = command.data;

        const nodeIdentifiers = solution.nodeIdentifiers.map(ni =>
            Utilities.normalizeHex(ni).toLowerCase());
        const replications = await Models.replicated_data.findAll({
            where: {
                offer_id: offerId,
                dh_identity: { [Op.in]: nodeIdentifiers },
            },
        });

        const colors = [];
        const confirmations = [];
        for (const identity of nodeIdentifiers) {
            const replication = replications.find(r => identity.includes(r.dh_identity));
            colors.push(replication.color);
            confirmations.push(replication.confirmation);
        }

        try {
            await this.blockchain.finalizeOffer(
                Utilities.normalizeHex(this.config.erc725Identity),
                offerId,
                new BN(solution.shift, 10),
                confirmations[0],
                confirmations[1],
                confirmations[2],
                colors,
                nodeIdentifiers,
            );
        } catch (error) {
            if (error.contains('gas price too high')) {
                this.logger.info('Gas price too high, delaying call for 30 minutes');
                Command.repeat();
            } else {
                throw error;
            }
        }

        return {
            commands: [
                {
                    name: 'dcOfferFinalizedCommand',
                    period: 5000,
                    data: { offerId },
                },
            ],
        };
    }

    /**
     * Try to recover command
     * @param command
     * @param err
     * @return {Promise<{commands: *[]}>}
     */
    async recover(command, err) {
        const {
            offerId,
            solution,
        } = command.data;

        const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
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
            this.logger.warn(`Failed to finalize offer ${offerId} because some of the DHs didn't have enough funds. Trying again...`);
            return {
                commands: [{
                    name: 'dcOfferChooseCommand',
                    data,
                    transactional: false,
                }],
            };
        }

        let errorMessage = err.message;
        const hasFunds = await this.dcService
            .hasProfileBalanceForOffer(offer.token_amount_per_holder);
        if (!hasFunds) {
            errorMessage = 'Not enough tokens. To replicate data please deposit more tokens to your profile';
        }
        this.logger.error(`Offer ${offerId} has not been finalized. ${errorMessage}`);

        offer.status = 'FAILED';
        offer.message = `Offer for ${offerId} has not been finalized. ${errorMessage}`;
        await offer.save({ fields: ['status', 'message'] });
        this.remoteControl.offerUpdate({
            offer_id: offerId,
        });

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
            name: 'dcOfferFinalizeCommand',
            delay: 0,
            period: 30 * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferFinalizeCommand;
