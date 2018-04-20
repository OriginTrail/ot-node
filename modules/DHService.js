const node = require('./Node');
const config = require('./Config');

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
     * @param dcId          DC Kademlia ID
     * @param offerParams   Offer parameters
     */
    static handleOffer(dcId, offerParams) {
        // TODO store offer if we want to participate.

        const minPrice = config.dh_min_price;
        const maxPrice = config.dh_max_price;
        const maxDataSizeBytes = config.dh_max_data_size_bytes;

        let chosenPrice = null;
        const {
            dataId, dcWallet, price, dataSizeBytes,
        } = offerParams;

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
        node.ot.addBid({
            bid: {
                price: chosenPrice,
            },
        }, dcId, (err) => {
            if (err) {
                log.warn(err);
            } else {
                log.trace(`Bid sent to ${dcId}.`);
                // SmartContractInstance.sc.addDcOffer(offerId, dcId);
            }
        });

        const bidIndex = 1; // TODO change after SC intro
        Models.bids.create({
            bid_index: bidIndex,
            offer_id: 1,
            price: chosenPrice,
            data_id: dataId,
            dc_wallet: dcWallet,
            dc_id: dcId,
            total_escrow_time: 10, // TODO change after SC intro
            stake: 1, // TODO remove hard-coded value
            data_size_bytes: dataSizeBytes,
        }).then((bid) => {
            log.info('Created new bid');
        }).catch((err) => {
            log.error('Failed to insert new bid.');
        });
    }
}

module.exports = DHService;
