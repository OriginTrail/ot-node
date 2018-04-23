const globalEvents = require('../GlobalEvents');
const log = require('../Utilities').getLogger();

const { globalEmitter } = globalEvents;

class MockSmartContract {
    constructor() {
        this.offers = [];
        this.dhs = [];
        this.dcs = [];

        // TODO: Check for already send offers and bids in database and start timers.
    }

    /**
     * Creates offer
     */
    createOffer(dataId, offer) {
        this.offers[dataId] = offer;
        this.dhs[dataId] = [];

        // simulate timed event
        // setTimeout(() => {
        //     log.info('Offer ended');
        //     globalEmitter.emit('offer-ended', {
        //         scId: dataId,
        //     });
        // }, 15 * 1000);
        return dataId;
    }

    /**
     * Adds single DH bid
     */
    addDhBid(dataId, dhBid) {
        this.dhs[dataId].push(dhBid);
    }

    addDcOffer(dataId, dcId) {
        this.dcs[dataId] = dcId;
    }

    /**
     * Choose some of the DHs
     */
    choose(dataId) {
        return this.dhs[dataId];
    }

    getDcForBid(dataId) {
        return this.dcs[dataId];
    }

    getBid(dataId, dhId) {
        return this.dhs[dataId].find(element => element.dhId === dhId);
    }
}

module.exports = MockSmartContract;
