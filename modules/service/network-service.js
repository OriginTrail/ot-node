const kadence = require('@deadcanaries/kadence');

const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');

class NetworkService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.profileService = ctx.profileService;
    }

    getPublicKeyData() {
        // todo pass blockchain identity
        return {
            nodeId: this.config.identity,
            public_key: this.config.publicKeyData.publicKey,
            nonce: this.config.publicKeyData.nonce,
            proof: this.config.publicKeyData.proof,
            erc725Identity: this.profileService.getIdentity('ethr'),
        };
    }

    async validatePublicKeyData(publicKeyData) {
        const {
            nodeId, public_key, nonce, proof,
        } = publicKeyData;

        const node_id = Utilities.denormalizeHex(nodeId.toString('hex'));
        const node_public_key = Buffer.from(public_key, 'hex');
        const node_proof = Buffer.from(proof, 'hex');

        const identity = new kadence.eclipse.EclipseIdentity(
            node_public_key,
            nonce,
            node_proof,
        );

        if (!identity.validate()) {
            this.logger.info('identity proof not yet solved, this can take a while');
            await identity.solve();
        }
        return identity.fingerprint.toString('hex').toLowerCase() === node_id;
    }

    /**
     * Function for retrieving a node's public key for message encryption
     * @param nodeId
     * @returns {Promise<string>}
     */
    async getNodePublicKey(nodeId) {
        const node_id = Utilities.denormalizeHex(nodeId);

        const foundModel = await Models.public_keys.findOne({
            where: { node_id },
        });

        if (foundModel) {
            const { timestamp, public_key } = foundModel;
            const keyIsExpired = timestamp =>
                timestamp + constants.PUBLIC_KEY_VALIDITY_IN_MILLS < Date.now();

            if (keyIsExpired(timestamp)) {
                this.logger.log(`Public key expired for node ${node_id}, removing entry from cache`);
                await Models.public_keys.destroy({
                    where: { node_id },
                });
                return undefined;
            }
            return public_key;
        }

        this.logger.log(`Public key not found for node ${node_id}`);
        return undefined;
    }

    /**
     * Function for updating or creating a cache for node's public key for message encryption
     * @param nodeId - Kademlia ID of the node
     * @param nodeERC - Address of a node's ERRC725 identity
     * @param public_key - The node's public key used for message encryption
     * @returns {Promise<string>}
     */
    async setNodePublicKey(publicKeyData) {
        const {
            nodeId, erc725Identity, public_key,
        } = publicKeyData;
        const node_id = Utilities.denormalizeHex(nodeId.toString('hex'));
        const node_erc = Utilities.normalizeHex(erc725Identity.toString('hex'));
        const node_public_key = Buffer.from(public_key, 'hex').toString('hex');

        const foundModel = await Models.public_keys.findOne({
            where: { node_id, node_erc },
        });

        if (foundModel) {
            foundModel.timestamp = Date.now();
            foundModel.public_key = node_public_key;
            await foundModel.save({ fields: ['timestamp', 'public_key'] });
        } else {
            await Models.public_keys.create({
                node_id,
                node_erc,
                public_key: node_public_key,
            });
        }

        this.logger.log(`Public key cache updated for contact ${node_id}`);

        return true;
    }
}

module.exports = NetworkService;
