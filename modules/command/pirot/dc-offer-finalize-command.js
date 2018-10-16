const BN = require('bn.js');

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
            colors.push(this._castColor(replication.color));
            confirmations.push(replication.confirmation);
        }

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

        const depositToken = await this.dcService.chainDepositCommandIfNeeded(
            offer.token_amount_per_holder,
            command.data,
            ['dcOfferFinalizeCommand'],
        );
        if (depositToken) {
            this.logger.warn(`Failed to finalize offer ${offerId} because DC didn't have enough funds. Trying again...`);
            return {
                commands: [depositToken],
            };
        }
        return Command.empty();
    }

    /**
     * Casts color to number (needed for Blockchain)
     * @param color
     */
    _castColor(color) {
        switch (color.toLowerCase()) {
        case 'red':
            return new BN(0, 10);
        case 'green':
            return new BN(1, 10);
        case 'blue':
            return new BN(2, 10);
        default:
            throw new Error(`Failed to cast color ${color}`);
        }
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
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferFinalizeCommand;
