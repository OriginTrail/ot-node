const kadence = require('@deadcanaries/kadence');

const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');

class NetworkService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    getPublicKeyData() {
        console.log(JSON.stringify({
            nodeId: this.config.identity.toString('hex'),
            public_key: this.config.publicKeyData.publicKey.toString('hex'),
            nonce: this.config.publicKeyData.nonce,
            proof: Buffer.from(this.config.publicKeyData.proof, 'hex'),
            erc725Identity: this.config.erc725Identity.toString('hex'),
        }));
        return {
            nodeId: this.config.identity.toString('hex'),
            public_key: this.config.publicKeyData.publicKey,
            nonce: this.config.publicKeyData.nonce,
            proof: this.config.publicKeyData.proof,
            erc725Identity: this.config.erc725Identity.toString('hex'),
        };
    }

    async validatePublicKeyData(publicKeyData, nodeId) {
        const identity = new kadence.eclipse.EclipseIdentity(
            publicKeyData.publicKey,
            publicKeyData.nonce,
            publicKeyData.proof,
        );

        if (!identity.validate()) {
            this.logger.info('identity proof not yet solved, this can take a while');
            await identity.solve();
        }
        return identity.fingerprint.toString('hex').toLowerCase() === nodeId;
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
            nodeId, erc725Identity, public_key, nonce, proof,
        } = publicKeyData;
        const node_id = Utilities.denormalizeHex(nodeId);
        const node_erc = Utilities.normalizeHex(erc725Identity);

        if (!this.validatePublicKeyData({ publicKey: Buffer.from(public_key, 'hex'), nonce, proof: Buffer.from(proof, 'hex') }, node_id)) { return false; }

        const foundModel = await Models.public_keys.findOne({
            where: { node_id, node_erc },
        });

        if (foundModel) {
            foundModel.timestamp = Date.now();
            foundModel.public_key = Buffer.from(public_key, 'hex').toString('hex');
            await foundModel.save({ fields: ['timestamp', 'public_key'] });
        } else {
            await Models.public_keys.create({
                node_id,
                node_erc,
                public_key: Buffer.from(public_key, 'hex').toString('hex'),
            });
        }

        this.logger.log(`Public key cache updated for contact ${node_id}`);

        return true;
    }
}

module.exports = NetworkService;
