const Models = require('../../../models/index');
const Command = require('../command');
const Utilities = require('../../Utilities');

const BN = require('bn.js');
const d3 = require('d3-format');

/**
 * Handles new offer from the DH side
 */
class DHOfferHandleCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.importer = ctx.importer;
        this.blockchain = ctx.blockchain;
        this.network = ctx.network;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            importId, totalEscrowTime,
        } = command.data;

        let {
            dcNodeId,
            maxTokenAmount,
            minStakeAmount,
            dataSizeBytes,
            predeterminedBid,
        } = command.data;

        dcNodeId = dcNodeId.substring(2, 42);
        const dcContact = await this.network.kademlia().getContact(dcNodeId, true);
        if (dcContact == null || dcContact.hostname == null) {
            // wait until peers are synced
            return Command.empty();
        }

        // Check if mine offer and if so ignore it.
        const offerModel = await Models.offers.findOne({ where: { import_id: importId } });
        if (offerModel) {
            return Command.empty();
        }

        this.logger.info(`New offer has been created by ${dcNodeId}. Offer ID ${importId}.`);

        const distanceParams = await this.blockchain.getDistanceParameters(importId);

        const nodeHash = distanceParams[0];
        const dataHash = distanceParams[1];
        const currentRanking = distanceParams[3]; // Not used at the moment
        const k = distanceParams[4];
        const numNodes = distanceParams[5];

        if (this.amIClose(k, numNodes, dataHash, nodeHash, 10000)) {
            this.logger.notify('Close enough to take bid');
        } else {
            this.logger.notify('Not close enough to take bid');
            return Command.empty();
        }

        const dataInfo = await Models.data_info.findOne({
            where: { import_id: importId },
        });
        if (dataInfo) {
            this.logger.trace(`I've already stored data for import ID ${importId}. Ignoring.`);
            return Command.empty();
        }

        let bidEvent;
        // Check if predetermined bid was already added for me.
        // Possible race condition here.
        if (!predeterminedBid) {
            // If event is in the table event will be handled on different call.
            const eventModels = await Models.events.findAll({
                where: {
                    import_id: importId,
                    event: 'AddedPredeterminedBid',
                },
            });

            if (eventModels) {
                eventModels.forEach((eventModel) => {
                    const data = JSON.parse(eventModel.data);
                    if (data.DH_node_id.substring(2, 42) === this.config.identity &&
                        data.DH_wallet === this.config.node_wallet) {
                        // I'm chosen for predetermined bid.
                        bidEvent = data;
                        predeterminedBid = true;
                    }
                });
            }
        }

        // Check if already applied.
        const bidModel = await Models.bids.findOne({ where: { import_id: importId } });
        if (bidModel) {
            this.logger.info(`I already sent my bid for offer: ${importId}.`);
            return Command.empty();
        }

        const profile = await this.blockchain.getProfile(this.config.node_wallet);

        const format = d3.formatPrefix(',.6~s', 1e6);
        const maxPrice = new BN(maxTokenAmount).toString();
        const minStake = new BN(minStakeAmount).toString();
        const formatMaxPrice = format(maxPrice);
        const formatMinStake = format(minStake);
        const formatMyPrice = format(profile.token_amount_per_byte_minute);
        const formatMyStake = format(profile.stake_amount_per_byte_minute);

        dataSizeBytes = new BN(dataSizeBytes);
        const totalEscrowTimePerMinute = new BN(totalEscrowTime);
        maxTokenAmount = new BN(maxTokenAmount)
            .mul(dataSizeBytes)
            .mul(new BN(totalEscrowTimePerMinute));
        minStakeAmount = new BN(minStakeAmount)
            .mul(dataSizeBytes)
            .mul(new BN(totalEscrowTimePerMinute));
        const myPrice = new BN(profile.token_amount_per_byte_minute)
            .mul(dataSizeBytes)
            .mul(new BN(totalEscrowTimePerMinute));
        const myStake = new BN(profile.stake_amount_per_byte_minute)
            .mul(dataSizeBytes)
            .mul(new BN(totalEscrowTimePerMinute));

        if (maxTokenAmount.lt(myPrice)) {
            this.logger.info(`Offer ${importId} too cheap for me.`);
            this.logger.info(`Maximum price offered ${formatMaxPrice}[mATRAC] per byte/min`);
            this.logger.info(`My price ${formatMyPrice}[mATRAC] per byte/min`);
            return Command.empty();
        }

        if (minStakeAmount.gt(myStake)) {
            this.logger.info(`Skipping offer ${importId}. Stake too high.`);
            this.logger.info(`Minimum stake required ${formatMinStake}[mATRAC] per byte/min`);
            this.logger.info(`My stake ${formatMyStake}[mATRAC] per byte/min`);
            return Command.empty();
        }

        if (!predeterminedBid && !Utilities.getImportDistance(myPrice, 1, myStake)) {
            this.logger.info(`Offer ${importId}, not in mine distance. Not going to participate.`);
            return Command.empty();
        }

        this.logger.trace(`Adding a bid for offer ${importId}.`);
        this.remoteControl.addingBid(`Adding a bid for offer ${importId}.`);

        const profileBalance = new BN(profile.balance, 10);

        const { data } = command;
        Object.assign(data, {
            myPrice: myPrice.toString(),
            myStake: myStake.toString(),
            dcNodeId,
            profileBalance: profileBalance.toString(),
        });

        const addBidCommand = predeterminedBid ? 'dhOfferBidAddPredeterminedCommand' : 'dhOfferBidAddCommand';
        if (profileBalance.lt(myStake)) {
            return {
                commands: [
                    this.build('biddingApprovalIncreaseCommand', this.pack(command.data), ['depositTokenCommand', addBidCommand]),
                ],
            };
        }

        return {
            commands: [
                this.build(addBidCommand, this.pack(data), null),
            ],
        };
    }

    /**
     * Checking if node Hash is close enugh to respond to bid
     * @param k - Number of required data holders
     * @param numNodes - Number of registered nodes on ODN network
     * @param dataHash - Import hash
     * @param nodeHash - DH node hash
     * @param correctionFactor
     */
    amIClose(k, numNodes, dataHash, nodeHash, correctionFactor = 100) {
        const two = new BN(2);
        const deg128 = two.pow(new BN(128));
        const intervalBn = deg128.div(new BN(numNodes, 10));

        const marginBn = intervalBn.mul(new BN(k, 10)).div(two);

        const dataHashBn = new BN(Utilities.denormalizeHex(dataHash), 16);

        let intervalTo;
        let higherMargin = marginBn;

        if (dataHashBn.lt(marginBn)) {
            intervalTo = (two).mul(marginBn);
            higherMargin = intervalTo.sub(dataHashBn);
        }


        if ((dataHashBn.add(marginBn)).gte(deg128)) {
            higherMargin = dataHashBn.add(marginBn).sub(deg128).add(marginBn);
        }

        const nodeHashBn = new BN(Utilities.denormalizeHex(nodeHash), 16);

        let distance;
        if (dataHashBn.gt(nodeHashBn)) {
            distance = dataHashBn.sub(nodeHashBn);
        } else {
            distance = nodeHashBn.sub(dataHashBn);
        }

        if (distance.lt(higherMargin.mul(new BN(correctionFactor)).div(new BN(100)))) {
            return true;
        }
        return false;
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        this.logger.warn('Trying to recover from dhOfferHandleCommand.');

        if (err.toString().includes('Transaction has been reverted by the EVM')) {
            const {
                importId,
            } = command.data;

            // Check if we're too late for bid.
            const offer = await this.blockchain.getOffer(importId);

            if (offer[0] !== '0x0000000000000000000000000000000000000000') {
                if (!offer.active || offer.finalized) {
                    this.logger.warn(`Offer for ${importId} was already finalized or not active. Failed to add bid.`);
                    return Command.empty();
                }
            }
        }

        throw err;
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferHandleCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferHandleCommand;
