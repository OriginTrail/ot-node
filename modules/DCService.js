const node = require('./Node');
const config = require('./Config');
const Blockchain = require('./BlockChainInstance');
const BN = require('bn.js');

const Utilities = require('./Utilities');
const Models = require('../models');

// TODO remove below after SC intro
const SmartContractInstance = require('./temp/MockSmartContractInstance');

const log = Utilities.getLogger();

// TODO
const totalEscrowTime = 6 * 60 * 1000;
const replicationFactor = 1;
const biddingTime = 100 * 1000;
const tenderDuration = biddingTime + 1000;
const minNumberOfBids = 1;
const minStakeAmount = 5;
const maxTokenAmount = new BN('100000000000000000000');
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
            price: `${Utilities.getRandomIntRange(1, 10).toString()}000000000000000000`,
            dataSizeBytes: '90000000',
            name: `Crazy data for ${totalDocuments} documents`,
        };

        // TODO call real SC
        const scId = SmartContractInstance.sc.createOffer(dataId, offerParams);
        log.info(`Created offer ${scId}`);

        Models.offers.create({
            id: dataId,
            data_lifespan: totalEscrowTime,
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            tender_duration: tenderDuration,
            min_number_applicants: minNumberOfBids,
            price_tokens: offerParams.price,
            data_size_bytes: offerParams.dataSizeBytes,
            replication_number: replicationFactor,
            root_hash: rootHash,
            max_token_amount: maxTokenAmount.toString(),
        }).then((offer) => {
            Blockchain.bc.createOffer(
                dataId, config.identity,
                totalEscrowTime,
                maxTokenAmount,
                minStakeAmount,
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
                    maxTokenAmount,
                    minStakeAmount,
                    biddingTime,
                    minNumberOfBids,
                    totalDocuments,
                    replicationFactor,
                });
                log.trace('Started bidding time');
                setTimeout(() => {
                    log.trace(`Started reveal time ${Date.now() / 1000}`);
                }, biddingTime);

                setTimeout(() => {
                    log.trace(`Started choose time ${Date.now() / 1000}`);
                }, biddingTime * 2);

                DCService.scheduleChooseBids(dataId, totalEscrowTime);
            }).catch((err) => {
                log.warn(`Failed to create offer. ${JSON.stringify(err)}`);
            });
        }).catch((error) => {
            log.error(`Failed to write offer to DB. ${error}`);
        });
    }

    /**
   * Schedule chose DHs
   * @param dataId            Data ID
   * @param totalEscrowTime   Total escrow time
   */
    static scheduleChooseBids(dataId, totalEscrowTime) {
        Models.offers.findOne({ where: { id: dataId } }).then((offerModel) => {
            const offer = offerModel.get({ plain: true });

            function chooseBids(dataId) {
                log.info(`Choose bids for data ${dataId}`);

                Blockchain.bc.increaseApproval(offer.max_token_amount * offer.replication_number)
                    .then(() => {
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
                                            DCService.handleFinalizedOffer(dataId);
                                            return true;
                                        }
                                    }
                                    return false;
                                }, 5000, Date.now() + totalEscrowTime);
                            }).catch((err) => {
                                log.warn(`Failed call choose bids for data ${dataId}. ${err}`);
                            });
                    }).catch((err) => {
                        log.warn(`Failed to increase allowance. ${JSON.stringify(err)}`);
                    });
            }
            // change time period in order to test choose bids
            setTimeout(chooseBids, 2 * offer.tender_duration, dataId);
        }).catch((error) => {
            log.error(`Failed to get offer (data ID ${dataId}). ${error}.`);
        });
    }

    /**
   * Process finalized offer
   * @param dataId    Data ID
   */
    static handleFinalizedOffer(dataId) {
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
                    log.info(`The bid is chosen for DH ${eventDhWallet} and data ${dataId}`);
                }
            }
            return true;
        }, 5000, Date.now() + 20000);
    }
}

module.exports = DCService;
