const node = require('./Node');

const Utilities = require('./Utilities');

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
     * @param offerId       Offer ID
     * @param offerParams   Offer parameters
     */
    static handleOffer(dcId, offerId, offerParams) {
        log.trace(`Received bidding. Name: ${offerParams.name}, price ${offerParams.price}.`);

        // TODO store offer if we want to participate.

        // TODO remove after SC intro
        node.ot.addBid({
            offerId,
            bid: {
                price: 1,
            },
        }, dcId, (err) => {
            if (err) {
                log.warn(err);
            } else {
                log.trace(`Bid sent to ${dcId}.`);
                SmartContractInstance.sc.addDcOffer(offerId, dcId);
            }
        });
    }
}

module.exports = DHService;
