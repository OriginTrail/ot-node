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

            const bidHash = abi.soliditySHA3(
                ['address', 'uint', 'uint', 'uint'],
                [config.node_wallet, `0x${config.identity}`, chosenPrice, stake],
            ).toString('hex');

            log.trace(`Adding a bid for DC wallet ${dcWallet} and data ID ${dataId} hash ${bidHash}`);

            Blockchain.bc.addBid(dcWallet, dataId, config.identity, `0x${bidHash}`)
                .then(Blockchain.bc.increaseBiddingApproval(stake))
                .catch(error => log.error(`Failed to add bid. ${error}.`));
            let bid_index;
            Blockchain.bc.subscribeToEvent('AddedBid', dataId)
                .then((event) => {
                    bid_index = event.bidIndex;
                    this._saveBidToStorage(
                        event,
                        dcNodeId,
                        chosenPrice,
                        totalEscrowTime,
                        stake,
                        dataSizeBytes,
                        dataId,
                    );
                }).catch((err) => {
                    console.log(err);
                });

            Blockchain.bc.subscribeToEvent('RevealPhaseStarted', dataId)
                .then((event) => {
                    log.info(`Reveal phase started for ${dataId}`);
                    Blockchain.bc.revealBid(
                        dcWallet, dataId,
                        config.identity, chosenPrice, stake, bid_index,
                    )
                        .then(() => {
                            log.info(`Bid revealed for import ${dataId} and DC ${dcWallet}`);
                        }).catch((err) => {
                            log.warn(`Failed to reveal bid for import ${dataId} and DC ${dcWallet}. ${JSON.stringify(err)}`);
                        });
                }).catch((err) => {
                    console.log(err);
                });

            Blockchain.bc.subscribeToEvent('OfferFinalized', dataId)
                .then((event) => {
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
                }).catch((err) => {
                    console.log(err);
                });
        } catch (e) {
            console.log(e);
        }
    }

    static _saveBidToStorage(
        event,
        dcNodeId, chosenPrice, totalEscrowTime, stake, dataSizeBytes, dataId,
    ) {
        Models.bids.create({
            bid_index: event.bidIndex,
            price: chosenPrice.toString(),
            data_id: dataId,
            dc_wallet: event.DC_wallet,
            dc_id: dcNodeId,
            hash: event.bid_hash,
            total_escrow_time: totalEscrowTime.toString(),
            stake: stake.toString(),
            data_size_bytes: dataSizeBytes.toString(),
        }).then((bid) => {
            log.info(`Created new bid for import ${dataId}. Waiting for reveal... `);
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
}

module.exports = DHService;
