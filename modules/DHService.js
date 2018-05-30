const config = require('./Config');
const BN = require('bn.js');

const Utilities = require('./Utilities');
const Models = require('../models');
const Encryption = require('./Encryption');

const log = Utilities.getLogger();

/**
 * DH operations (handling new offers, etc.)
 */
class DHService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.importer = ctx.importer;
        this.blockchain = ctx.blockchain;
        this.network = ctx.network;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
    }

    /**
     * Handles new offer
     *
     */
    async handleOffer(
        offerHash,
        dcNodeId,
        totalEscrowTime,
        maxTokenAmount,
        minStakeAmount,
        minReputation,
        dataSizeBytes,
        dataHash,
        predeterminedBid,
    ) {
        try {
            // Check if mine offer and if so ignore it.
            const offerModel = await Models.offers.findOne({ where: { id: offerHash } });
            if (offerModel) {
                const offer = offerModel.get({ plain: true });
                log.trace(`Mine offer (ID ${offer.data_hash}). Ignoring.`);
                return;
            }

            // Check if already applied.
            let bidModel = await Models.bids.findOne({ where: { offer_hash: offerHash } });
            if (bidModel) {
                log.info(`I already sent my bid for offer: ${offerHash}.`);
                return;
            }

            const minPrice = new BN(config.dh_min_price, 10);
            const maxPrice = new BN(config.dh_max_price, 10);
            const maxStakeAmount = new BN(config.dh_max_stake, 10);
            const maxDataSizeBytes = new BN(config.dh_max_data_size_bytes, 10);

            const profile = await this.blockchain.getProfile(config.node_wallet);

            maxTokenAmount = new BN(maxTokenAmount);
            minStakeAmount = new BN(minStakeAmount);
            dataSizeBytes = new BN(dataSizeBytes);
            const totalEscrowTimePerMinute = Math.round(totalEscrowTime / 60000);
            const myPrice = new BN(profile.token_amount)
                .mul(dataSizeBytes)
                .mul(new BN(totalEscrowTimePerMinute));
            const myStake = new BN(profile.stake_amount)
                .mul(dataSizeBytes)
                .mul(new BN(totalEscrowTimePerMinute));


            if (maxTokenAmount.lt(myPrice)) {
                log.info(`Offer ${offerHash} too expensive for me.`);
                return;
            }

            if (minStakeAmount.gt(myStake)) {
                log.info(`Skipping offer ${offerHash}. Stake too high.`);
                return;
            }

            if (maxDataSizeBytes.lt(dataSizeBytes)) {
                log.trace(`Skipping offer because of data size. Offer data size in bytes is ${dataSizeBytes}.`);
                return;
            }

            if (!predeterminedBid && !Utilities.getImportDistance(myPrice, 1, myStake)) {
                log.info(`Offer ${offerHash}, not in mine distance. Not going to participate.`);
                return;
            }

            log.trace(`Adding a bid for offer ${offerHash}.`);

            // From smart contract:
            // uint scope = this_offer.data_size * this_offer.total_escrow_time;
            // require((this_offer.min_stake_amount  <= this_DH.stake_amount * scope) &&
            //          (this_DH.stake_amount * scope <= profile[msg.sender].balance));
            const profileBalance = new BN(profile.balance, 10);
            const condition = myStake;

            if (profileBalance.lt(condition)) {
                await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
                await this.blockchain.depositToken(condition.sub(profileBalance));
            }

            await this.blockchain.addBid(offerHash, config.identity);
            // await blockchainc.increaseBiddingApproval(myStake);
            const addedBidEvent = await this.blockchain.subscribeToEvent('AddedBid', offerHash);
            const dcWallet = await this.blockchain.getDcWalletFromOffer(offerHash);
            this._saveBidToStorage(
                addedBidEvent,
                dcNodeId.substring(2, 42),
                dcWallet,
                myPrice,
                totalEscrowTime,
                myStake,
                dataSizeBytes,
                offerHash,
            );

            await this.blockchain.subscribeToEvent('OfferFinalized', offerHash);
            // Now check if bid taken.
            // emit BidTaken(offer_hash, this_bid.DH_wallet);
            const eventModelBid = await Models.events.findOne({
                where:
                    {
                        event: 'BidTaken',
                        offer_hash: offerHash,
                    },
            });
            if (!eventModelBid) {
                // Probably contract failed since no event fired.
                log.info(`BidTaken not received for offer ${offerHash}.`);
                return;
            }

            const eventBid = eventModelBid.get({ plain: true });
            const eventBidData = JSON.parse(eventBid.data);

            if (eventBidData.DH_wallet !== config.node_wallet) {
                log.info(`Bid not taken for offer ${offerHash}.`);
                return;
            }

            bidModel = await Models.bids.findOne({ where: { offer_hash: offerHash } });
            const bid = bidModel.get({ plain: true });
            this.network.kademlia().replicationRequest(
                {
                    offer_hash: offerHash,
                    wallet: config.node_wallet,
                },
                bid.dc_id, (err) => {
                    if (err) {
                        log.warn(`Failed to send replication request ${err}`);
                        // TODO Cancel bid here.
                    }
                },
            );
        } catch (error) {
            log.error(`Failed to handle offer. ${error}`);
        }
    }

    _saveBidToStorage(
        event,
        dcNodeId,
        dcWallet,
        chosenPrice,
        totalEscrowTime,
        stake,
        dataSizeBytes,
        offerHash,
    ) {
        Models.bids.create({
            bid_index: event.bid_index,
            price: chosenPrice.toString(),
            offer_hash: offerHash,
            dc_wallet: dcWallet,
            dc_id: dcNodeId,
            total_escrow_time: totalEscrowTime.toString(),
            stake: stake.toString(),
            data_size_bytes: dataSizeBytes.toString(),
        }).then((bid) => {
            log.info(`Created new bid for offer ${offerHash}. Waiting for reveal... `);
        }).catch((err) => {
            log.error(`Failed to insert new bid. ${err}`);
        });
    }

    async handleImport(data) {
        /*
            payload: {
                offer_hash: data.offer_hash,
                edges: data.edges,
                import_id: data.import_id,
                dc_wallet: config.blockchain.wallet_address,
                public_key: data.encryptedVertices.public_key,
                vertices: data.encryptedVertices.vertices,
            },
         */
        const bidModel = await Models.bids.findOne({ where: { offer_hash: data.offer_hash } });

        if (!bidModel) {
            log.warn(`Couldn't find bid for offer hash ${data.offer_hash}.`);
            return;
        }
        // TODO: Check data before signing escrow.
        const bid = bidModel.get({ plain: true });

        try {
            await this.importer.importJSON(data);
        } catch (err) {
            log.warn(`Failed to import JSON successfully. ${err}.`);
            return;
        }
        log.trace('[DH] Replication finished');

        try {
            await this.blockchain.increaseApproval(bid.stake);
            await this.blockchain.verifyEscrow(
                bid.dc_wallet,
                bid.offer_hash,
                bid.price,
                bid.stake,
                bid.total_escrow_time,
            );

            // Store holding information and generate keys for eventual
            // data replication.
            const keyPair = Encryption.generateKeyPair(512);
            const holdingData = await Models.holding_data.create({
                id: data.import_id,
                source_wallet: bid.dc_wallet,
                data_public_key: keyPair.privateKey,
                data_private_key: keyPair.privateKey,
            });

            if (!holdingData) {
                log.warn('Failed to store holding data info.');
            }

            log.important('Finished negotiation. Job starting. Waiting for challenges.');
            this.network.kademlia().replicationFinished({ status: 'success' }, bid.dc_id);
        } catch (error) {
            log.error(`Failed to verify escrow. ${error}.`);
        }
    }

    async handleDataLocationRequest(dataLocationRequestObject) {
        /*
            dataLocationRequestObject = {
                message: {
                    id: ID,
                    wallet: DV_WALLET,
                    nodeId: KAD_ID
                    query: [
                        [path, value, opcode],
                        [path, value, opcode],
                        ...
                    ]
                }
                messageSignature: {
                    v: …,
                    r: …,
                    s: …
                }
             }
         */

        const { message, messageSignature } = dataLocationRequestObject;

        // Check if mine publish.
        if (message.nodeId === config.identity &&
            message.wallet === config.node_wallet) {
            log.trace('Received mine publish. Ignoring.');
            return;
        }

        if (!Utilities.isMessageSigned(this.web3, message, messageSignature)) {
            log.warn(`We have a forger here. Signature doesn't match for message: ${message}`);
        }

        // Handle query here.
        const { query } = message;
        const imports = await this.graphStorage.findImportIds(query);
        if (imports.length === 0) {
            // I don't want to participate
            log.trace(`No imports found for request ${message.id}`);
            return;
        }

        /*
            dataLocationResponseObject = {
                message: {
                    id: ID,
                    wallet: DH_WALLET,
                    nodeId: KAD_ID,
                    imports: [
                                importId1,
                                importId2
                            ],
                    dataSize: DATA_BYTE_SIZE,
                    dataPrice: TOKEN_AMOUNT,
                    stakeFactor: X
                }
                messageSignature: {
                    c: …,
                    r: …,
                    s: …
                }
            }
         */

        const messageResponse = {
            id: message.id,
            wallet: config.node_wallet,
            nodeId: config.identity,
            imports,
            dataSize: 500,
            dataPrice: 100000,
            stakeFactor: 1000,
        };

        const messageResponseSignature =
            Utilities.generateRsvSignature(
                JSON.stringify(messageResponse),
                this.web3,
                config.node_private_key,
            );

        const dataLocationResponseObject = {
            message: messageResponse,
            messageSignature: messageResponseSignature,
        };

        this.network.kademlia().sendDataLocationResponse(
            dataLocationResponseObject,
            message.nodeId,
        );

        // Store message in DB to know later prices.
    }

    listenToOffers() {
        this.blockchain.subscribeToEventPermanent(['AddedPredeterminedBid', 'OfferCreated']);
    }
}

module.exports = DHService;
