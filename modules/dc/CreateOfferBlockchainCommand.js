const BN = require('bn.js');
const Models = require('../../models');
const Command = require('../command/Command');

const WaitFinalizeOfferReadyCommand = require('../dc/WaitFinalizeOfferReadyCommand');

class CreateOfferBlockchainCommand extends Command {
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
     * @param transaction
     */
    async execute(command, transaction) {
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

        const numberOfReplications = new BN((dhWallets.length * 2) + 1);
        const profile = await this.blockchain.getProfile(this.config.node_wallet);

        const profileBalance = new BN(profile.balance, 10);
        const condition = maxTokenAmount
            .mul(numberOfReplications)
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
        this.logger.info('Offer written to blockchain.');
        this.remoteControl.biddingStarted(importId);

        const offer = await Models.offers.findOne({ where: { id: offerId } });
        offer.status = 'STARTED';
        await offer.save({ fields: ['status'] });
        return {
            commands: [
                WaitFinalizeOfferReadyCommand.buildDefault({
                    data: command.data,
                }),
            ],
        };
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'createOfferBlockchain',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = CreateOfferBlockchainCommand;
