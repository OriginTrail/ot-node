const BN = require('bn.js');
const ethAbi = require('ethereumjs-abi');

const Utilities = require('./Utilities');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const Encryption = require('./RSAEncryption');
const bytes = require('utf8-length');

/**
 * DV operations (querying network, etc.)
 */
class DVService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.blockchain = ctx.blockchain;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
    }

    async checkFingerprintData(data_set_id, offer) {
        const datasets = JSON.parse(offer.data_set_ids);
        const dataset_info = datasets.find(e => e.data_set_id === data_set_id);
        if (!dataset_info
            || !dataset_info.fingerprint_data
            || !Array.isArray(dataset_info.fingerprint_data)
            || dataset_info.fingerprint_data.length === 0) {
            const message = `Cannot read ${data_set_id} without fingerprint data in network query response.`;
            return {
                passed: false,
                message,
            };
        }

        const validationResult = {
            root_hashes_received: 0,
            root_hashes_fetched: 0,
            root_hashes_valid: 0,
        };
        const myBlockchainIds = this.blockchain.getAllBlockchainIds();
        for (const fingerprint_object of dataset_info.fingerprint_data) {
            const { blockchain_id, root_hash } = fingerprint_object;

            if (root_hash) {
                validationResult.root_hashes_received += 1;

                if (myBlockchainIds.includes(blockchain_id)) {
                    // eslint-disable-next-line no-await-in-loop
                    const fingerprint = await this
                        .blockchain.getRootHash(data_set_id, blockchain_id).response;

                    validationResult.root_hashes_fetched += 1;

                    if (fingerprint && !Utilities.isZeroHash(fingerprint)
                        && Utilities.compareHexStrings(fingerprint, root_hash)) {
                        validationResult.root_hashes_valid += 1;
                    } else if (fingerprint && !Utilities.isZeroHash(fingerprint)) {
                        this.logger.warn('Root hashes do not match. ' +
                            `Found ${fingerprint} on blockchain ${blockchain_id} but expected ${root_hash} based on network response`);
                    } else {
                        this.logger.warn('Root hashes do not match. ' +
                            `Found empty hash on blockchain ${blockchain_id} but expected ${root_hash} based on network response`);
                    }
                } else {
                    this.logger.trace(`Cannot validate root hash for dataset ${data_set_id} on unsupported blockchain ${blockchain_id}.`);
                }
            }
        }

        if (validationResult.root_hashes_received === 0) {
            const message = `Cannot read dataset ${data_set_id} because no fingerprint was sent.`;
            return {
                passed: false,
                message,
            };
        }

        if (validationResult.root_hashes_fetched === 0) {
            const message = `Cannot read dataset ${data_set_id} because no fingerprint could be fetched.`;
            return {
                passed: false,
                message,
            };
        }

        if (validationResult.root_hashes_fetched !== validationResult.root_hashes_valid) {
            const message = `Cannot read dataset ${data_set_id} because a fingerprint check failed.`;
            return {
                passed: false,
                message,
            };
        }

        return {
            passed: true,
        };
    }
}

module.exports = DVService;
