const globalEvents = require('../GlobalEvents');
const log = require('../Utilities').getLogger();

const { globalEmitter } = globalEvents;

class MockSmartContract {
    constructor() {
        this.offers = [];
        this.dhs = [];
    }

    /**
     * Creates offer
     */
    createOffer(dataId, offer) {
        this.offers[dataId] = offer;
        this.dhs[dataId] = [];

        // simulate timed event
        setTimeout(() => {
            log.info('Offer ended');
            globalEmitter.emit('offer-ended', {
                scId: dataId,
            });
        }, 5 * 1000);
        return dataId;
    }

    /**
     * Adds single DH bid
     */
    addDhBid(dataId, dhBid) {
        this.dhs[dataId].push(dhBid);
    }

    /**
     * Choose some of the DHs
     */
    choose(dataId) {
        return this.dhs[dataId];
    }
}

module.exports = MockSmartContract;
