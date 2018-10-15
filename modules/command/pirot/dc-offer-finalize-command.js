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
            const replication = replications.find((r) => {
                return identity.includes(r.dh_identity);
            });
            colors.push(this.castColor(replication.color));
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
     * Casts color to number (needed for Blockchain)
     * @param color
     */
    castColor(color) {
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
