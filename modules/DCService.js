const node = require('./Node');
const config = require('./Config');
const Encryption = require('./Encryption');
const Graph = require('./Graph');
const Blockchain = require('./BlockChainInstance');
const bytes = require('utf8-length');
const BN = require('bn.js');
const Utilities = require('./Utilities');
const Models = require('../models');
const abi = require('ethereumjs-abi');

const log = Utilities.getLogger();

const totalEscrowTime = 10 * 60 * 1000;
const finalizeWaitTime = 10 * 60 * 1000;
const minStakeAmount = new BN('100');
const maxTokenAmount = new BN('1000');
const minReputation = 0;
/**
 * DC operations (handling new offers, etc.)
 */
class DCService {
    static createOffer(dataId, rootHash, totalDocuments, vertices) {
        Blockchain.bc.writeRootHash(dataId, rootHash).then((res) => {
            log.info('Fingerprint written on blockchain');
        }).catch((e) => {
            console.log('Error: ', e);
        });

        const dhWallets = [];
        const dhIds = [];

        vertices.forEach((vertex) => {
            if (vertex.data && vertex.data.wallet && vertex.data.node_id) {
                dhWallets.push(vertex.data.wallet);
                dhIds.push(vertex.data.node_id);
            }
        });

        const importSizeInBytes = new BN(this._calculateImportSize(vertices));

        const offerHash = abi.soliditySHA3(
            ['address', 'bytes32', 'uint256'],
            [config.wallet, `0x${config.identity}`, dataId],
        ).toString('hex');

        log.info(`Offer hash is ${offerHash}.`);

        Models.offers.create({
            id: dataId,
            total_escrow_time: totalEscrowTime,
            max_token_amount: maxTokenAmount.toString(),
            min_stake_amount: minStakeAmount.toString(),
            min_reputation: minReputation,
            data_hash: rootHash,
            data_size_bytes: importSizeInBytes.toString(),
            dh_ids: JSON.stringify(dhIds),
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            status: 'PENDING',
        }).then((offer) => {
            Blockchain.bc.createOffer(
                dataId,
                config.identity,
                totalEscrowTime,
                maxTokenAmount,
                minStakeAmount,
                minReputation,
                rootHash,
                importSizeInBytes,
                dhWallets,
                dhIds,
            ).then(() => {
                log.info('Offer written to blockchain. Started bidding phase.');
                offer.status = 'STARTED';
                offer.save({ fields: ['status'] });

                const finalizationCallback = () => {
                    Models.offers.findOne({ where: { id: dataId } }).then((offerModel) => {
                        if (offerModel.status === 'STARTED') {
                            log.warn('Event for finalizing offer hasn\'t arrived yet. Setting status to FAILED.');

                            offer.status = 'FAILED';
                            offer.save({ fields: ['status'] });
                        }
                    });
                };

                Blockchain.bc.subscribeToEvent('FinalizeOfferReady', null, finalizeWaitTime, finalizationCallback).then(() => {
                    log.trace('Started choosing phase.');

                    offer.status = 'FINALIZING';
                    offer.save({ fields: ['status'] });
                    DCService.chooseBids(dataId, totalEscrowTime).then(() => {
                        Blockchain.bc.subscribeToEvent('OfferFinalized', dataId)
                            .then(() => {
                                offer.status = 'FINALIZED';
                                offer.save({ fields: ['status'] });

                                log.info(`Offer for ${dataId} finalized`);
                            }).catch((error) => {
                                log.error(`Failed to get offer (data ID ${dataId}). ${error}.`);
                            });
                    }).catch(() => {
                        offer.status = 'FAILED';
                        offer.save({ fields: ['status'] });
                    });
                });
            }).catch((err) => {
                log.warn(`Failed to create offer. ${err}`);
            });
        }).catch((error) => {
            log.error(`Failed to write offer to DB. ${error}`);
        });
    }

    /**
     * Calculates more or less accurate size of the import
     * @param vertices   Collection of vertices
     * @returns {number} Size in bytes
     * @private
     */
    static _calculateImportSize(vertices) {
        const keyPair = Encryption.generateKeyPair(); // generate random pair of keys
        Graph.encryptVerticesWithKeys(vertices, keyPair.privateKey, keyPair.publicKey);
        return bytes(JSON.stringify(vertices));
    }

    /**
     * Chose DHs
     * @param dataId            Data ID
     * @param totalEscrowTime   Total escrow time
     */
    static chooseBids(dataId, totalEscrowTime) {
        return new Promise((resolve, reject) => {
            Models.offers.findOne({ where: { id: dataId } }).then((offerModel) => {
                const offer = offerModel.get({ plain: true });
                log.info(`Choose bids for data ${dataId}`);
                Blockchain.bc.increaseApproval(offer.max_token_amount * offer.replication_number)
                    .then(() => {
                        Blockchain.bc.chooseBids(dataId)
                            .then(() => {
                                log.info(`Bids chosen for data ${dataId}`);
                                resolve();
                            }).catch((err) => {
                                log.warn(`Failed call choose bids for data ${dataId}. ${err}`);
                                reject(err);
                            });
                    }).catch((err) => {
                        log.warn(`Failed to increase allowance. ${JSON.stringify(err)}`);
                        reject(err);
                    });
            }).catch((err) => {
                log.error(`Failed to get offer (data ID ${dataId}). ${err}.`);
                reject(err);
            });
        });
    }
}

module.exports = DCService;
