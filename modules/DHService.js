const node = require('./Node');
const config = require('./Config');
const BN = require('bn.js');
const abi = require('ethereumjs-abi');
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
        minStakeAmount,
        dataSizeBytes,
    ) {
        // TODO store offer if we want to participate.
        const minPrice = config.dh_min_price;
        const maxPrice = config.dh_max_price;
        const maxStakeAmount = config.dh_max_stake;
        const maxDataSizeBytes = config.dh_max_data_size_bytes;

        const chosenPrice = Math.round(Utilities.getRandomIntRange(minPrice, maxPrice));

        if (minStakeAmount > maxStakeAmount) {
            log.trace(`Skipping offer because of the minStakeAmount. MinStakeAmount is ${maxStakeAmount}.`);
            return;
        }
        const stake = Math.round(Utilities.getRandomIntRange(minStakeAmount, maxStakeAmount));

        if (maxDataSizeBytes < dataSizeBytes) {
            log.trace(`Skipping offer because of data size. Offer data size in bytes is ${dataSizeBytes}.`);
            return;
        }

        const bidHash = abi.soliditySHA3(
            ['address', 'uint256', 'uint256', 'uint256'],
            [config.node_wallet, new BN(config.identity, 16), chosenPrice, stake],
        ).toString('hex');

        log.trace(`Adding a bid for DC wallet ${dcWallet} and data ID ${dataId}`);
        Blockchain.bc.addBid(dcWallet, dataId, config.identity, bidHash)
            .then(() => {
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
                                price: chosenPrice,
                                data_id: dataId,
                                dc_wallet: dcWallet,
                                dc_id: dcNodeId,
                                hash: bidHash,
                                total_escrow_time: totalEscrowTime,
                                stake,
                                data_size_bytes: dataSizeBytes,
                            }).then((bid) => {
                                log.info(`Created new bid for import ${dataId}. Schedule reveal... `);
                                DHService.scheduleRevealBid(
                                    dcWallet, dataId, chosenPrice,
                                    stake, bidIndex, totalEscrowTime,
                                );
                            }).catch((err) => {
                                log.error(`Failed to insert new bid. ${err}`);
                            });
                        }
                    }
                    return true;
                }, 5000, Date.now() + 20000);
            }).catch((error) => {
                log.error(error);
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
                }).catch((err) => {
                    log.warn(`Failed to reveal bid for import ${dataId} and DC ${dcWallet}. ${err}`);
                });
        }
        setTimeout(
            revealBid, 2000,
            dcWallet, dataId, price, stake, bidIndex,
        );
    }
}

module.exports = DHService;
