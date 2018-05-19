const node = require('./Node');
const config = require('./Config');
const BN = require('bn.js');
const Blockchain = require('./BlockChainInstance');
const importer = require('./importer')();

const Utilities = require('./Utilities');
const Models = require('../models');

const log = Utilities.getLogger();

/**
 * DH operations (handling new offers, etc.)
 */
class DHService {
    /**
   * Handles new offer
   *
   */
    static async handleOffer(
        offerHash,
        dcNodeId,
        totalEscrowTime,
        maxTokenAmount,
        minStakeAmount,
        minReputation,
        dataSizeBytes,
        dataHash,
        predeterminedBid,
    ) {
        try {
            // Check if mine offer and if so ignore it.
            const offerModel = await Models.offers.findOne({ where: { id: offerHash } });
            if (offerModel) {
                const offer = offerModel.get({ plain: true });
                log.trace(`Mine offer (ID ${offer.data_hash}). Ignoring.`);
                return;
            }

            // Check if we are in the predetermined list
            const eventModel = await Models.events.findOne({
                where: {
                    event: 'AddedPredeterminedBid',
                    offer_hash: offerHash,
                },
            });
            if (eventModel && !predeterminedBid) {
                // skip handling since we are already doing it
                log.trace('We are already in the predetermined list. Skip handling.');
                return;
            }

            const minPrice = new BN(config.dh_min_price, 10);
            const maxPrice = new BN(config.dh_max_price, 10);
            const maxStakeAmount = new BN(config.dh_max_stake, 10);
            const maxDataSizeBytes = new BN(config.dh_max_data_size_bytes, 10);

            let temp = maxPrice.sub(minPrice);
            temp = Utilities.getRandomIntRange(0, temp.toNumber());
            const chosenPrice = minPrice.add(new BN(temp.toString()));

            minStakeAmount = new BN(minStakeAmount);
            dataSizeBytes = new BN(dataSizeBytes);

            if (minStakeAmount > maxStakeAmount) {
                log.trace(`Skipping offer because of the minStakeAmount. MinStakeAmount is ${minStakeAmount}.`);
                return;
            }

            temp = maxStakeAmount.sub(minStakeAmount);
            temp = Utilities.getRandomIntRange(0, temp.toNumber());
            const stake = minPrice.add(new BN(temp.toString()));

            if (maxDataSizeBytes.lt(dataSizeBytes)) {
                log.trace(`Skipping offer because of data size. Offer data size in bytes is ${dataSizeBytes}.`);
                return;
            }

            if (!predeterminedBid && !Utilities.getImportDistance(chosenPrice, 1, stake)) {
                log.info(`Offer ${offerHash}, not in mine distance. Not going to participate.`);
                return;
            }

            log.trace(`Adding a bid for offer ${offerHash}.`);

            Blockchain.bc.addBid(offerHash, config.identity)
                .then(Blockchain.bc.increaseBiddingApproval(stake))
                .catch(error => log.error(`Failed to add bid. ${error}.`));
            Blockchain.bc.subscribeToEvent('AddedBid', offerHash)
                .then(async (event) => {
                    const dcWallet = await Blockchain.bc.getDcWalletFromOffer(offerHash);
                    this._saveBidToStorage(
                        event,
                        dcNodeId.substring(2, 42),
                        dcWallet,
                        chosenPrice,
                        totalEscrowTime,
                        stake,
                        dataSizeBytes,
                        offerHash,
                    );
                }).catch((err) => {
                    console.log(err);
                });

            Blockchain.bc.subscribeToEvent('OfferFinalized', offerHash)
                .then((event) => {
                    Models.bids.findOne({ where: { offer_hash: offerHash } }).then((bidModel) => {
                        const bid = bidModel.get({ plain: true });
                        node.ot.replicationRequest(
                            {
                                offer_hash: offerHash,
                                wallet: config.node_wallet,
                            },
                            bid.dc_id, (err) => {
                                if (err) {
                                    log.warn(`Failed to send replication request ${err}`);
                                    // TODO Cancel bid here.
                                }
                            },
                        );
                    });
                }).catch((err) => {
                    console.log(err);
                });
        } catch (e) {
            console.log(e);
        }
    }

    static _saveBidToStorage(
        event,
        dcNodeId,
        dcWallet,
        chosenPrice,
        totalEscrowTime,
        stake,
        dataSizeBytes,
        offerHash,
    ) {
        Models.bids.create({
            bid_index: event.bid_index,
            price: chosenPrice.toString(),
            offer_hash: offerHash,
            dc_wallet: dcWallet,
            dc_id: dcNodeId,
            total_escrow_time: totalEscrowTime.toString(),
            stake: stake.toString(),
            data_size_bytes: dataSizeBytes.toString(),
        }).then((bid) => {
            log.info(`Created new bid for offer ${offerHash}. Waiting for reveal... `);
        }).catch((err) => {
            log.error(`Failed to insert new bid. ${err}`);
        });
    }

    static handleImport(data) {
        Models.bids.findOne({ where: { data_id: data.data_id } }).then(async (bidModel) => {
            // TODO: Check data before signing escrow.
            const bid = bidModel.get({ plain: true });

            try {
                await importer.importJSON(data);
            } catch (err) {
                log.warn(`Failed to import JSON successfully. ${err}.`);
                return;
            }
            log.trace('[DH] Replication finished');
            Blockchain.bc.increaseApproval(bid.stake).then(() => {
                Blockchain.bc.verifyEscrow(
                    bid.dc_wallet,
                    data.data_id,
                    bid.price,
                    bid.stake,
                    bid.total_escrow_time,
                ).then(() => {
                    // TODO No need to notify DC. DC should catch event from verifyEscrow().
                    log.important('Finished negotiation. Job starting. Waiting for challenges.');
                    node.ot.replicationFinished({ status: 'success' }, bid.dc_id);
                }).catch((error) => {
                    log.error(`Failed to verify escrow. ${error}`);
                });
            }).catch((e) => {
                log.error(`Failed to increase approval. ${e}`);
            });
        }).catch((error) => {
            log.error(`Couldn't find bid with data ID ${data.data_id}. ${error}.`);
        });
    }

    static listenToOffers() {
        Blockchain.bc.subscribeToEventPermanent(['AddedPredeterminedBid', 'OfferCreated']);
    }
}

module.exports = DHService;
