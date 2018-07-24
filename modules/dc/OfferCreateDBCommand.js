const BN = require('bn.js');
const Models = require('../../models');

const Graph = require('../Graph');
const Encryption = require('../Encryption');
const bytes = require('utf8-length');

const Command = require('../command/Command');

class OfferCreateDBCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
    }

    async execute(command, transaction) {
        const {
            importId,
            rootHash,
            total_escrow_time,
            max_token_amount,
            min_stake_amount,
            min_reputation,
        } = command.data;

        const dhIds = [];
        const dhWallets = [];

        let totalEscrowTime = new BN(this.config.total_escrow_time_in_milliseconds);
        let maxTokenAmount = new BN(this.config.max_token_amount_per_dh, 10);
        let minStakeAmount = new BN(this.config.dh_min_stake_amount, 10);
        let minReputation = this.config.dh_min_reputation;

        if (total_escrow_time) {
            totalEscrowTime = new BN(total_escrow_time);
        }

        if (max_token_amount) {
            maxTokenAmount = new BN(max_token_amount, 10);
        }

        if (min_stake_amount) {
            minStakeAmount = new BN(min_stake_amount, 10);
        }

        if (min_reputation) {
            minReputation = min_reputation;
        }

        const vertices = await this.graphStorage.findVerticesByImportId(importId);
        vertices.forEach((vertex) => {
            if (vertex.data && vertex.data.wallet && vertex.data.node_id) {
                dhWallets.push(vertex.data.wallet);
                dhIds.push(vertex.data.node_id);
            }
        });

        totalEscrowTime = totalEscrowTime.div(new BN(60000));
        const importSizeInBytes = new BN(this._calculateImportSize(vertices));
        let newOfferRow = {
            import_id: importId,
            total_escrow_time: totalEscrowTime.toString(),
            max_token_amount: maxTokenAmount.toString(),
            min_stake_amount: minStakeAmount.toString(),
            min_reputation: minReputation,
            data_hash: rootHash,
            data_size_bytes: importSizeInBytes.toString(),
            dh_wallets: dhWallets,
            dh_ids: dhIds,
            message: 'Offer is pending',
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            status: 'PENDING',
        };
        newOfferRow = await Models.offers.create(newOfferRow, { transaction });

        const { data } = command;
        Object.assign(data, {
            dhIds,
            dhWallets,
            totalEscrowTime,
            maxTokenAmount,
            minStakeAmount,
            minReputation,
            importSizeInBytes,
            offerId: newOfferRow.id,
        });
        return this.continueSequence(data, command.sequence);
    }

    /**
     * Calculates more or less accurate size of the import
     * @param vertices   Collection of vertices
     * @returns {number} Size in bytes
     * @private
     */
    _calculateImportSize(vertices) {
        const keyPair = Encryption.generateKeyPair(); // generate random pair of keys
        Graph.encryptVertices(vertices, keyPair.privateKey);
        return bytes(JSON.stringify(vertices));
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'offerCreateDB',
            delay: 0,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OfferCreateDBCommand;
