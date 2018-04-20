const node = require('./Node');
const config = require('./Config');
const Blockchain = require('./Blockchain');

const Utilities = require('./Utilities');
const Models = require('../models');

// TODO remove below after SC intro
const SmartContractInstance = require('./temp/MockSmartContractInstance');

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

        if (price == null) {
            log.trace(`Skipping offer because of price. Offer price is ${price}.`);
            return;
        }

        if (maxDataSizeBytes < dataSizeBytes) {
            log.trace(`Skipping offer because of data size. Offer data size in bytes is ${dataSizeBytes}.`);
            return;
        }

        // TODO remove after SC intro

        Blockchain.bc.addBid(dcWallet, dataId, config.identity, chosenPrice, 1000).then((bidIndex) => {
            Models.bids.create({
                bid_index: bidIndex,
                offer_id: 1,
                price: chosenPrice,
                data_id: dataId,
                dc_wallet: dcWallet,
                dc_id: dcNodeId,
                total_escrow_time: totalEscrowTime,
                stake: 1000, // TODO remove hard-coded value
                data_size_bytes: dataSizeBytes,
            }).then((bid) => {
                log.info('Created new bid');
            }).catch((err) => {
                log.error('Failed to insert new bid.');
            });
        }).catch(error => log.error(error));
    }
}

module.exports = DHService;
