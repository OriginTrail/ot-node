const node = require('./Node');
const config = require('./Config');
const Encryption = require('./Encryption');
const Graph = require('./Graph');
const Blockchain = require('./BlockChainInstance');
const bytes = require('utf8-length');
const BN = require('bn.js');
const Utilities = require('./Utilities');
const Models = require('../models');

const log = Utilities.getLogger();

// TODO
const totalEscrowTime = 10 * 60 * 1000;
const replicationFactor = 1;
const biddingTime = 2 * 60 * 1000;
const tenderDuration = biddingTime + 1000;
const minNumberOfBids = 1;
const minStakeAmount = new BN('100');
const maxTokenAmount = new BN('1000');
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

        const importSizeInBytes = new BN(this._calculateImportSize(vertices));
        const price = `${Utilities.getRandomIntRange(1, 10).toString()}00`;
        Models.offers.create({
            id: dataId,
            data_lifespan: totalEscrowTime,
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            tender_duration: tenderDuration,
            min_number_applicants: minNumberOfBids,
            price_tokens: price,
            data_size_bytes: importSizeInBytes.toString(),
            replication_number: replicationFactor,
            root_hash: rootHash,
            max_token_amount: maxTokenAmount.toString(),
        }).then((offer) => {
            Blockchain.bc.createOffer(
                dataId,
                config.identity,
                totalEscrowTime,
                maxTokenAmount,
                minStakeAmount,
                biddingTime,
                minNumberOfBids,
                importSizeInBytes,
                replicationFactor,
            ).then((startTime) => {
                log.info('Offer written to blockchain. Broadcast event.');
                node.ot.quasar.quasarPublish('bidding-broadcast-channel', {
                    dataId,
                    dcId: config.identity,
                    dcWallet: config.node_wallet,
                    totalEscrowTime,
                    maxTokenAmount: maxTokenAmount.toString(),
                    minStakeAmount: minStakeAmount.toString(),
                    biddingTime,
                    minNumberOfBids,
                    importSizeInBytes: importSizeInBytes.toString(),
                    replicationFactor,
                });
                log.trace('Started bidding phase');
                Blockchain.bc.subscribeToEvent('ChoosingPhaseStarted', dataId)
                    .then((event) => {
                        log.trace('Started choosing phase.');
                        DCService.chooseBids(dataId, totalEscrowTime);
                    }).catch((err) => {
                        console.log(err);
                    });
            }).catch((err) => {
                log.warn(`Failed to create offer. ${JSON.stringify(err)}`);
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
        Models.offers.findOne({ where: { id: dataId } }).then((offerModel) => {
            const offer = offerModel.get({ plain: true });
            log.info(`Choose bids for data ${dataId}`);
            Blockchain.bc.increaseApproval(offer.max_token_amount * offer.replication_number)
                .then(() => {
                    Blockchain.bc.chooseBids(dataId)
                        .then(() => {
                            log.info(`Bids chosen for data ${dataId}`);
                        }).catch((err) => {
                            log.warn(`Failed call choose bids for data ${dataId}. ${err}`);
                        });
                }).catch((err) => {
                    log.warn(`Failed to increase allowance. ${JSON.stringify(err)}`);
                });

            Blockchain.bc.subscribeToEvent('OfferFinalized', dataId)
                .then((event) => {
                    log.info(`Offer for ${dataId} finalized`);
                }).catch((error) => {
                    log.error(`Failed to get offer (data ID ${dataId}). ${error}.`);
                });
        }).catch((error) => {
            log.error(`Failed to get offer (data ID ${dataId}). ${error}.`);
        });
    }
}

module.exports = DCService;
