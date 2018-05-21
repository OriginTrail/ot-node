const node = require('./Node');
const config = require('./Config');
const BN = require('bn.js');
const Blockchain = require('./BlockChainInstance');
const importer = require('./importer')();

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
    static async handleOffer(
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

            const profile = await Blockchain.bc.getProfile(config.node_wallet);

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
                await Blockchain.bc.increaseBiddingApproval(condition.sub(profileBalance));
                await Blockchain.bc.depositToken(condition.sub(profileBalance));
            }

            await Blockchain.bc.addBid(offerHash, config.identity);
            // await Blockchain.bc.increaseBiddingApproval(myStake);
            const addedBidEvent = await Blockchain.bc.subscribeToEvent('AddedBid', offerHash);
            const dcWallet = await Blockchain.bc.getDcWalletFromOffer(offerHash);
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

            await Blockchain.bc.subscribeToEvent('OfferFinalized', offerHash);
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
            node.ot.replicationRequest(
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

    static _saveBidToStorage(
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

    static async handleImport(data) {
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
            await importer.importJSON(data);
        } catch (err) {
            log.warn(`Failed to import JSON successfully. ${err}.`);
            return;
        }
        log.trace('[DH] Replication finished');

        try {
            await Blockchain.bc.increaseApproval(bid.stake);
            await Blockchain.bc.verifyEscrow(
                bid.dc_wallet,
                bid.offer_hash,
                bid.price,
                bid.stake,
                bid.total_escrow_time,
            );

            log.important('Finished negotiation. Job starting. Waiting for challenges.');
            node.ot.replicationFinished({ status: 'success' }, bid.dc_id);
        } catch (error) {
            log.error(`Failed to verify escrow. ${error}.`);
        }
    }

    static listenToOffers() {
        Blockchain.bc.subscribeToEventPermanent(['AddedPredeterminedBid', 'OfferCreated']);
    }
}

module.exports = DHService;
