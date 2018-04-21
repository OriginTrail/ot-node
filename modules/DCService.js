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
            }).catch((err) => {
                log.warn(`Failed to create offer. ${JSON.stringify(err)}`);
            });
        }).catch((err) => {
            log.warn(`Failed to increase bidding approval. ${JSON.stringify(err)}`);
        });
    }
}

module.exports = DCService;
