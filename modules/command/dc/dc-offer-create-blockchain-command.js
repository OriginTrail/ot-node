const Command = require('../command');
const Models = require('../../../models/index');
const BN = require('bn.js');

/**
 * Creates offer on blockchain
 */
class DCOfferCreateBlockchainCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            importId,
            minStakeAmount,
            maxTokenAmount,
            minReputation,
            rootHash,
            dhIds,
            dhWallets,
            importSizeInBytes,
            totalEscrowTime,
            offerId,
        } = command.data;

        this.remoteControl.initializingOffer(importId);

        const profile = await this.blockchain.getProfile(this.config.node_wallet);
        const profileBalance = new BN(profile.balance, 10);

        const replicationModifier = await this.blockchain.getReplicationModifier();

        const condition = maxTokenAmount
            .mul((new BN((dhWallets.length * 2)).add(new BN(replicationModifier, 10))))
            .mul(importSizeInBytes)
            .mul(totalEscrowTime);

        if (profileBalance.lt(condition)) {
            await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
            await this.blockchain.depositToken(condition.sub(profileBalance));
        }

        await this.blockchain.createOffer(
            importId,
            this.config.identity,
            totalEscrowTime,
            maxTokenAmount,
            minStakeAmount,
            minReputation,
            rootHash,
            importSizeInBytes,
            dhWallets,
            dhIds,
        );
        this.logger.important(`Offer ${importId} written to blockchain. Started bidding phase.`);
        this.remoteControl.biddingStarted(importId);

        const offer = await Models.offers.findOne({ where: { id: offerId } });
        offer.status = 'STARTED';
        await offer.save({ fields: ['status'] });

        const { data } = command;
        return this.continueSequence(this.pack(data), command.sequence);
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            totalEscrowTime: data.totalEscrowTime.toString(),
            maxTokenAmount: data.maxTokenAmount.toString(),
            minStakeAmount: data.minStakeAmount.toString(),
            importSizeInBytes: data.importSizeInBytes.toString(),
        });
        return data;
    }

    /**
     * Unpack data from database
     * @param data
     * @returns {Promise<*>}
     */
    unpack(data) {
        const parsed = data;
        Object.assign(parsed, {
            totalEscrowTime: new BN(data.totalEscrowTime, 10),
            maxTokenAmount: new BN(data.maxTokenAmount, 10),
            minStakeAmount: new BN(data.minStakeAmount, 10),
            importSizeInBytes: new BN(data.importSizeInBytes, 10),
        });
        return parsed;
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferCreateBlockchainCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferCreateBlockchainCommand;
