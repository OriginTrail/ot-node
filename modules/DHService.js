const node = require('./Node');
const config = require('./Config');
const BN = require('bn.js');
const abi = require('ethereumjs-abi');
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
    static handleOffer(
        dcWallet,
        dcNodeId,
        dataId,
        totalEscrowTime,
        minStakeAmount,
        dataSizeBytes,
    ) {
        try {
            const minPrice = new BN(config.dh_min_price, 10);
            const maxPrice = new BN(config.dh_max_price, 10);
            const maxStakeAmount = new BN(config.dh_max_stake, 10);
            const maxDataSizeBytes = new BN(config.dh_max_data_size_bytes, 10);

            let temp = maxPrice.sub(minPrice);
            temp = Utilities.getRandomIntRange(0, temp.toNumber());
            const chosenPrice = minPrice.add(new BN(temp.toString()));

            if (minStakeAmount > maxStakeAmount) {
                log.trace(`Skipping offer because of the minStakeAmount. MinStakeAmount is ${minStakeAmount}.`);
                return;
            }

            console.log(maxStakeAmount.toString(), minStakeAmount.toString());
            temp = maxStakeAmount.sub(minStakeAmount);
            temp = Utilities.getRandomIntRange(0, temp.toNumber());
            const stake = minPrice.add(new BN(temp.toString()));

            if (maxDataSizeBytes.lt(dataSizeBytes)) {
                log.trace(`Skipping offer because of data size. Offer data size in bytes is ${dataSizeBytes}.`);
                return;
            }

            const bidHash = abi.soliditySHA3(
                ['address', 'uint', 'uint', 'uint'],
                [config.node_wallet, new BN(config.identity, 16), chosenPrice, stake],
            ).toString('hex');
        } catch (e) {
            console.log(e);
        }
        log.trace(`Adding a bid for DC wallet ${dcWallet} and data ID ${dataId} hash ${bidHash}`);
        Blockchain.bc.addBid(dcWallet, dataId, config.identity, `0x${bidHash}`)
            .then((tx) => {
                // Sign escrow.
                Blockchain.bc.increaseBiddingApproval(stake).catch(error => log.error(`Failed to increase approval. ${error}.`));

                Blockchain.bc.subscribeToEvent('BIDDING_CONTRACT', 'AddedBid', {
                    fromBlock: 0,
                    toBlock: 'latest',
                }, (data, err) => {
                    if (err) {
                        log.error(err);
                        return true;
                    }
                    // filter events manually since Web3 filtering is not working
                    for (const event of data) {
                        const eventDataId = event.returnValues.data_id;
                        const eventDhWallet = event.returnValues.DH_wallet;

                        if (Number(eventDataId) === dataId
                  && eventDhWallet === config.node_wallet) {
                            const { bidIndex } = event.returnValues;
                            Models.bids.create({
                                bid_index: bidIndex,
                                price: chosenPrice.toString(),
                                data_id: dataId,
                                dc_wallet: dcWallet,
                                dc_id: dcNodeId,
                                hash: bidHash,
                                total_escrow_time: totalEscrowTime.toString(),
                                stake: stake.toString(),
                                data_size_bytes: dataSizeBytes.toString(),
                            }).then((bid) => {
                                log.info(`Created new bid for import ${dataId}. Schedule reveal... `);

                                DHService.scheduleRevealBid(
                                    dcWallet, dataId, chosenPrice,
                                    stake, bidIndex, totalEscrowTime,
                                );
                            }).catch((err) => {
                                log.error(`Failed to insert new bid. ${err}`);
                            });
                            return true;
                        }
                    }
                    return false;
                }, 5000, Date.now() + 20000);
            }).catch((err) => {
                log.error(err);
            });
    }

    static handleImport(data) {
        Models.bids.findOne({ where: { data_id: data.data_id } }).then((bidModel) => {
            // TODO: Check data before signing escrow.
            const bid = bidModel.get({ plain: true });
            importer.importJSON(data)
                .then(() => {
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
                            node.ot.replicationFinished({ status: 'success' }, bid.dc_id);
                        }).catch((error) => {
                            log.error(`Failed to verify escrow. ${error}`);
                        });
                    }).catch((e) => {
                        log.error(`Failed to verify escrow. ${e}`);
                    });
                }).catch((error) => {
                    log.error(`Failed to import data. ${error}`);
                });
        }).catch((error) => {
            log.error(`Couldn't find bid with data ID ${data.data_id}. ${error}.`);
        });
    }

    /**
   * Schedule reveal before todtalEscrowTime
   * @param dcWallet          DC wallet
   * @param dataId            Data ID
   * @param price             Price
   * @param stake             Stake
   * @param bidIndex          Bid indez
   * @param totalEscrowTime   Total escrow time
   * @private
   */
    static scheduleRevealBid(dcWallet, dataId, price, stake, bidIndex, totalEscrowTime) {
        function revealBid(dcWallet, dataId, price, stake, bidIndex) {
            Blockchain.bc.revealBid(dcWallet, dataId, config.identity, price, stake, bidIndex)
                .then(() => {
                    log.info(`Bid revealed for import ${dataId} and DC ${dcWallet}`);
                    DHService.checkIfRevealed(dcWallet, dataId);
                }).catch((err) => {
                    log.warn(`Failed to reveal bid for import ${dataId} and DC ${dcWallet}. ${JSON.stringify(err)}`);
                });
        }
        setTimeout(
        // change time period in order to test reveal
            revealBid, 25 * 1000,
            dcWallet, dataId, price, stake, bidIndex,
        );
    }

    /**
   * Check whether bid has successfully been revealed
   * @param dcWallet  DH wallet
   * @param dataId    Data ID
   */
    static checkIfRevealed(dcWallet, dataId) {
        Blockchain.bc.subscribeToEvent('BIDDING_CONTRACT', 'RevealedBid', {
            fromBlock: 0,
            toBlock: 'latest',
        }, (data, err) => {
            if (err) {
                log.error(err);
                return true;
            }
            // filter events manually since Web3 filtering is not working
            for (const event of data) {
                const eventDataId = event.returnValues.data_id;
                const eventDcWallet = event.returnValues.DC_wallet;

                if (Number(eventDataId) === dataId
            && eventDcWallet === dcWallet) {
                    log.info(`Successfully revealed bid for data ${dataId}.`);
                    DHService.scheduleOfferFinalizedCheck(dataId, dcWallet);
                    return true;
                }
            }
            return false;
        }, 5000, Date.now() + (15 * 60 * 1000));
    }

    /**
   * Schedule check whether the offer is finalized or not
   * @param dataId    Data ID
   * @param dcWallet  DC wallet
   */
    static scheduleOfferFinalizedCheck(dataId, dcWallet) {
        Blockchain.bc.subscribeToEvent('BIDDING_CONTRACT', 'OfferFinalized', {
            fromBlock: 0,
            toBlock: 'latest',
        }, (data, err) => {
            if (err) {
                log.error(err);
                return true;
            }
            // filter events manually since Web3 filtering is not working
            for (const event of data) {
                const eventDataId = event.returnValues.data_id;
                const eventDcWallet = event.returnValues.DC_wallet;

                if (Number(eventDataId) === dataId
            && eventDcWallet === dcWallet) {
                    log.info(`Offer for data ${dataId} successfully finalized. Check if the bid is chosen.`);
                    DHService.scheduleBidChosenCheck(dataId, dcWallet);
                    return true;
                }
            }
            return false;
        }, 5000, Date.now() + (15 * 60 * 1000));
    }

    /**
   * Schedule check for whether the bid is chosed for the particular import
   * @param dataId    Data ID
   * @param dcWallet  DC wallet
   */
    static scheduleBidChosenCheck(dataId, dcWallet) {
        Blockchain.bc.subscribeToEvent('BIDDING_CONTRACT', 'BidTaken', {
            fromBlock: 0,
            toBlock: 'latest',
        }, (data, err) => {
            if (err) {
                log.error(err);
                return true;
            }
            // filter events manually since Web3 filtering is not working
            for (const event of data) {
                const eventDataId = event.returnValues.data_id;
                const eventDhWallet = event.returnValues.DH_wallet;
                const eventDcWallet = event.returnValues.DC_wallet;

                if (Number(eventDataId) === dataId
            && eventDhWallet === config.node_wallet && eventDcWallet === dcWallet) {
                    log.info(`The bid is chosen for DC ${dcWallet} and data ${dataId}`);

                    Models.bids.findOne({ where: { data_id: dataId } }).then((bidModel) => {
                        const bid = bidModel.get({ plain: true });
                        node.ot.replicationRequest(
                            {
                                dataId,
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

                    return true;
                }
            }
            return false;
        }, 5000, Date.now() + (15 * 60 * 1000));
    }
}

module.exports = DHService;
