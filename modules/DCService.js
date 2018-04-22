const node = require('./Node');
const config = require('./Config');
const Blockchain = require('./BlockChainInstance');

const Utilities = require('./Utilities');
const Models = require('../models');

// TODO remove below after SC intro
const SmartContractInstance = require('./temp/MockSmartContractInstance');

const log = Utilities.getLogger();

// TODO
const totalEscrowTime = 10 * 60 * 1000; // 10 minute
const replicationFactor = 10;
const biddingTime = 1 * 60 * 1000; // 1 minute
const minNumberOfBids = 20;
const minStakeAmount = 2;
/**
 * DC operations (handling new offers, etc.)
 */
class DCService {
    static createOffer(dataId, rootHash, totalDocuments) {
        Blockchain.bc.writeRootHash(dataId, rootHash).then((res) => {
            log.info('Fingerprint written on blockchain');
        }).catch((e) => {
            console.log('Error: ', e);
        });

        // TODO set real offer params
        const offerParams = {
            price: Utilities.getRandomIntRange(1, 10),
            dataSizeBytes: 900,
            name: `Crazy data for ${totalDocuments} documents`,
        };

        // TODO call real SC
        const scId = SmartContractInstance.sc.createOffer(dataId, offerParams);
        log.info(`Created offer ${scId}`);

        Blockchain.bc.increaseBiddingApproval(minStakeAmount).then(() => {
            Blockchain.bc.createOffer(
                dataId, config.identity,
                totalEscrowTime, minStakeAmount,
                biddingTime,
                minNumberOfBids,
                totalDocuments, replicationFactor,
            ).then((startTime) => {
                log.info('Offer written to blockchain. Broadcast event.');
                node.ot.quasar.quasarPublish('bidding-broadcast-channel', {
                    dataId,
                    dcId: config.identity,
                    dcWallet: config.node_wallet,
                    totalEscrowTime,
                    minStakeAmount,
                    biddingTime,
                    minNumberOfBids,
                    totalDocuments,
                    replicationFactor,
                });
                DCService.scheduleChooseBids(dataId, totalEscrowTime);
            }).catch((err) => {
                log.warn(`Failed to create offer. ${JSON.stringify(err)}`);
            });
        }).catch((err) => {
            log.warn(`Failed to increase bidding approval. ${JSON.stringify(err)}`);
        });
    }


    /**
     * Schedule chose DHs
     * @param dataId            Data ID
     * @param totalEscrowTime   Total escrow time
     */
    static scheduleChooseBids(dataId, totalEscrowTime) {
        function chooseBids(dataId) {
            Blockchain.bc.chooseBids(dataId)
                .then(() => {
                    log.info(`Bids choose called for data ${dataId}`);

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
                                && eventDcWallet === config.node_wallet) {
                                log.info(`Offer for data ${dataId} successfully finalized`);

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

                                        if (Number(eventDataId) === dataId && eventDcWallet === config.node_wallet) {
                                            log.info(`The bid is chosen for DC ${eventDcWallet} and data ${dataId}`);

                                            // Sign escrow.
                                            Models.offers({ where: { id: dataId } }).then((offerModel) => {
                                                Blockchain.bc.increaseBiddingApproval(offerModel.price_tokens).then(() => {
                                                    Blockchain.bc.initiateEscrow(eventDhWallet, offerModel.price_tokens).catch((error) => {
                                                        log.error(`Failed find offer with data ID ${dataId}. ${error}`);
                                                    });
                                                }).catch(error => log.error(error));
                                            }).catch(error => log.error(error));
                                        }
                                    }
                                    return true;
                                }, 5000, Date.now() + 20000);


                                return true;
                            }
                        }
                        return false;
                    }, 5000, Date.now() + 10000);
                }).catch((err) => {
                    log.warn(`Failed call choose bids for data ${dataId}. ${err}`);
                });
        }
        // change time period in order to test choose bids
        setTimeout(chooseBids, totalEscrowTime * 1000, dataId);
    }
}

module.exports = DCService;
