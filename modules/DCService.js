const config = require('./Config');
const Encryption = require('./Encryption');
const Graph = require('./Graph');
const bytes = require('utf8-length');
const BN = require('bn.js');
const Utilities = require('./Utilities');
const Models = require('../models');
const abi = require('ethereumjs-abi');

const log = Utilities.getLogger();

const totalEscrowTime = 10 * 60 * 1000;
const finalizeWaitTime = 10 * 60 * 1000;
const minStakeAmount = new BN('100');
const maxTokenAmount = new BN('1000000');
const minReputation = 0;
/**
 * DC operations (handling new offers, etc.)
 */
class DCService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.blockchain = ctx.blockchain;
    }

    async createOffer(dataId, rootHash, totalDocuments, vertices) {
        /**
         * check if offer is already created
         */
        this.blockchain.getOffer(dataId).then((res) => {
            console.log(res);
        }).catch((err) => {
            console.log(err);
        });

        this.blockchain.writeRootHash(dataId, rootHash).then((res) => {
            log.info('Fingerprint written on blockchain');
        }).catch((e) => {
            console.log('Error: ', e);
        });

        const dhWallets = [];
        const dhIds = [];

        vertices.forEach((vertex) => {
            if (vertex.data && vertex.data.wallet && vertex.data.node_id) {
                dhWallets.push(vertex.data.wallet);
                dhIds.push(vertex.data.node_id);
            }
        });

        const importSizeInBytes = new BN(this._calculateImportSize(vertices));

        // TODO: Store offer hash in DB.
        const offerHash = `0x${abi.soliditySHA3(
            ['address', 'bytes32', 'uint256'],
            [config.node_wallet, `0x${config.identity}`, dataId],
        ).toString('hex')}`;

        log.info(`Offer hash is ${offerHash}.`);

        const newOfferRow = {
            import_id: dataId,
            total_escrow_time: totalEscrowTime,
            max_token_amount: maxTokenAmount.toString(),
            min_stake_amount: minStakeAmount.toString(),
            min_reputation: minReputation,
            data_hash: rootHash,
            data_size_bytes: importSizeInBytes.toString(),
            dh_wallets: JSON.stringify(dhWallets),
            dh_ids: JSON.stringify(dhIds),
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            status: 'PENDING',
        };
        var localOfferId;
        const offer = await Models.offers.create(newOfferRow);

        // From smart contract:
        // require(profile[msg.sender].balance >=
        // max_token_amount.mul(predetermined_DH_wallet.length.mul(2).add(1)));
        // Check for balance.
        const profileBalance =
            new BN((await this.blockchain.getProfile(config.node_wallet)).balance, 10);
        const condition = maxTokenAmount.mul(new BN((dhWallets.length * 2) + 1));

        if (profileBalance.lt(condition)) {
            await this.blockchain.increaseBiddingApproval(condition - profileBalance);
            await this.blockchain.depositToken(condition - profileBalance);
        }

        this.blockchain.createOffer(
            dataId,
            config.identity,
            totalEscrowTime,
            maxTokenAmount,
            minStakeAmount,
            minReputation,
            rootHash,
            importSizeInBytes,
            dhWallets,
            dhIds,
        ).then(() => {
            log.info('Offer written to blockchain. Started bidding phase.');
            offer.status = 'STARTED';
            offer.save({ fields: ['status'] });

            const finalizationCallback = () => {
                Models.offers.findOne({ where: { id: offer.id } }).then((offerModel) => {
                    if (offerModel.status === 'STARTED') {
                        log.warn('Event for finalizing offer hasn\'t arrived yet. Setting status to FAILED.');

                        offer.status = 'FAILED';
                        offer.save({ fields: ['status'] });
                    }
                });
            };

            this.blockchain.subscribeToEvent('FinalizeOfferReady', null, finalizeWaitTime, finalizationCallback).then(() => {
                log.trace('Started choosing phase.');

                offer.status = 'FINALIZING';
                offer.save({ fields: ['status'] });
                this.chooseBids(offer.id, totalEscrowTime).then(() => {
                    this.blockchain.subscribeToEvent('OfferFinalized', offer.id)
                        .then(() => {
                            offer.status = 'FINALIZED';
                            offer.save({ fields: ['status'] });

                            log.info(`Offer for ${offer.id} finalized`);
                        }).catch((error) => {
                            log.error(`Failed to get offer ${offer.id}). ${error}.`);
                        });
                }).catch(() => {
                    offer.status = 'FAILED';
                    offer.save({ fields: ['status'] });
                });
            });
        }).catch((err) => {
            log.log('error', 'Failed to create offer. %j', err);
        });
    }

    /**
     * Calculates more or less accurate size of the import
     * @param vertices   Collection of vertices
     * @returns {number} Size in bytes
     * @private
     */
    _calculateImportSize(vertices) {
        const keyPair = Encryption.generateKeyPair(); // generate random pair of keys
        Graph.encryptVerticesWithKeys(vertices, keyPair.privateKey, keyPair.publicKey);
        return bytes(JSON.stringify(vertices));
    }

    /**
     * Chose DHs
     * @param offerHash Offer identifier
     * @param totalEscrowTime   Total escrow time
     */
    chooseBids(offerHash, totalEscrowTime) {
        return new Promise((resolve, reject) => {
            Models.offers.findOne({ where: { id: offerHash } }).then((offerModel) => {
                const offer = offerModel.get({ plain: true });
                log.info(`Choose bids for offer ${offerHash}`);
                this.blockchain.increaseApproval(offer.max_token_amount * offer.replication_number)
                    .then(() => {
                        this.blockchain.chooseBids(offerHash)
                            .then(() => {
                                log.info(`Bids chosen for data ${offerHash}`);
                                resolve();
                            }).catch((err) => {
                                log.warn(`Failed call choose bids for data ${offerHash}. ${err}`);
                                reject(err);
                            });
                    }).catch((err) => {
                        log.warn(`Failed to increase allowance. ${JSON.stringify(err)}`);
                        reject(err);
                    });
            }).catch((err) => {
                log.error(`Failed to get offer (data ID ${offerHash}). ${err}.`);
                reject(err);
            });
        });
    }
}

module.exports = DCService;
