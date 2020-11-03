const BN = require('bn.js');
const Command = require('../command');
const Utilities = require('../../Utilities');
const Encryption = require('../../RSAEncryption');
const Models = require('../../../models/index');

/**
 * Handles replication request
 */
class DcReplicationSendCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.web3 = ctx.web3;

        this.replicationService = ctx.replicationService;
        this.permissionedDataService = ctx.permissionedDataService;
        this.importService = ctx.importService;
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            internalOfferId, wallet, identity, dhIdentity,
        } = command.data;

        const colorNumber = Utilities.getRandomInt(2);
        const color = this.replicationService.castNumberToColor(colorNumber);

        const offer = await Models.offers.findOne({ where: { id: internalOfferId } });
        const replication = await this.replicationService.loadReplication(offer.id, color);
        await Models.replicated_data.create({
            dh_id: identity,
            dh_wallet: wallet.toLowerCase(),
            dh_identity: dhIdentity.toLowerCase(),
            offer_id: offer.offer_id,
            litigation_private_key: replication.litigationPrivateKey,
            litigation_public_key: replication.litigationPublicKey,
            distribution_public_key: replication.distributionPublicKey,
            distribution_private_key: replication.distributionPrivateKey,
            distribution_epk_checksum: replication.distributionEpkChecksum,
            litigation_root_hash: replication.litigationRootHash,
            distribution_root_hash: replication.distributionRootHash,
            distribution_epk: replication.distributionEpk,
            status: 'STARTED',
            color: colorNumber,
        });

        const toSign = [
            Utilities.denormalizeHex(new BN(replication.distributionEpkChecksum).toString('hex')),
            Utilities.denormalizeHex(replication.distributionRootHash),
        ];
        const distributionSignature = Encryption.signMessage(
            this.web3, toSign,
            Utilities.normalizeHex(this.config.node_private_key),
        );

        const permissionedData = await this.permissionedDataService.getAllowedPermissionedData(
            offer.data_set_id,
            identity,
        );

        const promises = [];
        for (const ot_object_id in permissionedData) {
            promises.push(this.importService.getOtObjectById(offer.data_set_id, ot_object_id));
        }

        const ot_objects = await Promise.all(promises);

        await this.permissionedDataService.attachPermissionedDataToMap(
            permissionedData,
            ot_objects,
        );

        const payload = {
            offer_id: offer.offer_id,
            data_set_id: offer.data_set_id,
            dc_wallet: this.config.node_wallet,
            dcIdentity: this.config.erc725Identity,
            dcNodeId: this.config.network.identity,
            otJson: replication.otJson,
            permissionedData,
            litigation_public_key: replication.litigationPublicKey,
            distribution_public_key: replication.distributionPublicKey,
            distribution_private_key: replication.distributionPrivateKey,
            distribution_epk_checksum: replication.distributionEpkChecksum,
            litigation_root_hash: replication.litigationRootHash,
            distribution_root_hash: replication.distributionRootHash,
            distribution_epk: replication.distributionEpk,
            distribution_signature: distributionSignature.signature,
            transaction_hash: offer.transaction_hash,
            distributionSignature,
            color: colorNumber,
        };

        // send replication to DH
        const response = await this.transport.replicationData(payload, identity);

        if (response.status === 'fail') {
            this.logger.warn(`Sending replication data for offer ${offer.id} to ${identity} failed. ${response.message}`);
        } else {
            this.logger.info(`Replication data for offer ${offer.id} successfully sent to ${identity}.`);
        }

        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcReplicationSendCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcReplicationSendCommand;
