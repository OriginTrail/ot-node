const node = require('./Node');
const config = require('./Config');
const Blockchain = require('./BlockChainInstance');

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
        price,
        dataSizeBytes,
    ) {
        // TODO store offer if we want to participate.

        const minPrice = config.dh_min_price;
        const maxPrice = config.dh_max_price;
        const maxDataSizeBytes = config.dh_max_data_size_bytes;

        let chosenPrice = null;

        if (price > minPrice && price < maxPrice) {
            chosenPrice = Utilities.getRandomIntRange(minPrice, maxPrice);
        }

        if (chosenPrice == null) {
            log.trace(`Skipping offer because of price. Offer price is ${price}.`);
            return;
        }

        if (maxDataSizeBytes < dataSizeBytes) {
            log.trace(`Skipping offer because of data size. Offer data size in bytes is ${dataSizeBytes}.`);
            return;
        }

        // TODO remove after SC intro
        log.trace(`Adding a bid for DC waller ${dcWallet} and data ID ${dataId}`);
        Blockchain.bc.addBid(dcWallet, dataId, config.identity, 20, 1000)
            .then((bidIndex) => {
                Models.bids.create({
                    bid_index: bidIndex,
                    price: chosenPrice,
                    data_id: dataId,
                    dc_wallet: dcWallet,
                    dc_id: dcNodeId,
                    total_escrow_time: totalEscrowTime,
                    stake: 1000, // TODO remove hard-coded value
                    data_size_bytes: dataSizeBytes,
                }).then((bid) => {
                    log.info(`Created new bid. ${JSON.stringify(bid)}`);
                }).catch((err) => {
                    log.error(`Failed to insert new bid. ${JSON.stringify(err)}`);
                });
            }).catch((error) => {
                log.error(error);
            });
    }
}

module.exports = DHService;
