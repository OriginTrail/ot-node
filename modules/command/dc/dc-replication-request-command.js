const BN = require('../../../node_modules/bn.js/lib/bn');
const path = require('path');

const Command = require('../command');
const Encryption = require('../../Encryption');
const Utilities = require('../../Utilities');
const models = require('../../../models/index');

/**
 * Handles replication request
 */
class DCReplicationRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.web3 = ctx.web3;
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            offerId, wallet, identity, dhIdentity,
        } = command.data;
        const offer = await models.offers.findOne({
            where: {
                offer_id: offerId,
                status: 'STARTED',
            },
        });
        if (!offer) {
            this.logger.info(`Cannot serve the replication for DH ${dhIdentity}. Offer ${offerId} is not in STARTED state.`);
            return Command.empty();
        }

        const colors = ['red', 'green', 'blue'];
        const color = colors[Utilities.getRandomInt(2)];

        const replication = await this.replicationService.loadReplication(offer.id, color);
        await models.replicated_data.create({
            dh_id: identity,
            dh_wallet: wallet.toLowerCase(),
            dh_identity: dhIdentity.toLowerCase(),
            offer_id: offer.offer_id,
            litigation_public_key: replication.litigationPublicKey,
            distribution_public_key: replication.distributionPublicKey,
            distribution_private_key: replication.distributionPrivateKey,
            distribution_epk_checksum: replication.distributionEpkChecksum,
            litigation_root_hash: replication.litigationRootHash,
            distribution_root_hash: replication.distributionRootHash,
            distribution_epk: replication.distributionEpk,
            status: 'STARTED',
            color,
        });

        const toSign = [
            Utilities.denormalizeHex(new BN(replication.distributionEpkChecksum).toString('hex')),
            Utilities.denormalizeHex(replication.distributionRootHash),
        ];
        const distributionSignature = Encryption.signMessage(
            this.web3, toSign,
            Utilities.normalizeHex(this.config.node_private_key),
        );

        const payload = {
            payload: {
                offer_id: offerId,
                data_set_id: offer.data_set_id,
                dc_wallet: this.config.node_wallet,
                edges: replication.edges,
                litigation_vertices: replication.litigationVertices,
                litigation_public_key: replication.litigationPublicKey,
                distribution_public_key: replication.distributionPublicKey,
                distribution_private_key: replication.distributionPrivateKey,
                distribution_epk_checksum: replication.distributionEpkChecksum,
                litigation_root_hash: replication.litigationRootHash,
                distribution_root_hash: replication.distributionRootHash,
                transaction_hash: replication.transaction_hash,
                distribution_epk: replication.distributionEpk,
                distribution_signature: distributionSignature.signature,
                distributionSignature,
            },
        };
        // send replication to DH
        await this.transport.replicationResponse(payload, identity);
        this.logger.info(`Replication for offer ID ${offer.id} sent to ${identity}.`);
        return Command.empty();
    }

    /**
     * Builds default dcReplicationRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcReplicationRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCReplicationRequestCommand;
