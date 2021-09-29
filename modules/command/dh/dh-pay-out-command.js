const Command = require('../command');
const constants = require('../../constants');
const Blockchain = require('../../Blockchain');

const Models = require('../../../models/index');

/**
 * Starts token withdrawal operation
 */
class DhPayOutCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
        this.profileService = ctx.profileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            urgent,
        } = command.data;

        let {
            blockchain_id,
        } = command.data;

        if (!command.data.retryNumber) {
            command.data.retryNumber = 1;
        }

        const bid = await Models.bids.findOne({
            where: {
                offer_id: offerId,
                status: { [Models.Sequelize.Op.in]: ['COMPLETED', 'CHOSEN'] },
            },
        });

        if (!blockchain_id) {
            if (bid && bid.blockchain_id) {
                // eslint-disable-next-line prefer-destructuring
                blockchain_id = bid.blockchain_id;
            } else {
                this.logger.important(`Cannot determine blockchain_id for offer ${offerId}. Cannot execute payout.`);
                return Command.empty();
            }
        }

        const blockchainIdentity = this.profileService.getIdentity(blockchain_id);

        if (!bid) {
            this.logger.important(`There is no successful bid for offer ${offerId}. Cannot execute payout.`);
            await this._printBalances(blockchainIdentity, blockchain_id);
            return Command.empty();
        }
        if (bid.status !== 'COMPLETED') {
            bid.status = 'COMPLETED';
            bid.message = `Offer ${offerId} has been completed`;
            await bid.save({ fields: ['status', 'message'] });
            this.logger.important(`Offer ${offerId} has been completed successfully.`);
        }

        const { status, timestamp } = await this.blockchain
            .getLitigation(offerId, blockchainIdentity, blockchain_id).response;

        const { litigation_interval_in_minutes } = await Models.bids.findOne({
            where: {
                offer_id: offerId,
            },
        });

        const litigationTimestamp = parseInt(timestamp, 10) * 1000;

        const blockTimestamp = Date.now();
        if (status === '1' && !(litigationTimestamp + (litigation_interval_in_minutes * 2 * 60000) < blockTimestamp)) {
            this.logger.info(`Unanswered litigation for offer ${offerId} in progress, cannot be payed out.`);
        } else if (status === '2' && !(litigationTimestamp + (60000 * litigation_interval_in_minutes) < blockTimestamp)) {
            this.logger.info(`Unanswered litigation for offer ${offerId} in progress, cannot be payed out.`);
        } else if (status !== '0') {
            this.logger.info(`I'm replaced or being replaced for offer ${offerId}, cannot be payed out.`);
        } else {
            try {
                await this.blockchain
                    .payOut(blockchainIdentity, offerId, urgent, blockchain_id).response;
                this.logger.important(`Payout for offer ${offerId} successfully completed on blockchain ${blockchain_id}.`);
                await this._clearReplicationDatabaseData(offerId);
                await this._printBalances(blockchainIdentity, blockchain_id);
            } catch (error) {
                let delay = constants.PAYOUT_COMMAND_RETRY_DELAY_IN_MILISECONDS;
                if (error.message.includes('Gas price higher than maximum allowed price')) {
                    this.logger.info(`Gas price too high, delaying call for ${constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS / 60000} minutes`);
                    delay = constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS;
                }
                return this.rescheduleFailedPayout(command, delay);
            }
        }

        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        return this
            .rescheduleFailedPayout(command, constants.PAYOUT_COMMAND_RETRY_DELAY_IN_MILISECONDS);
    }

    rescheduleFailedPayout(command, delay) {
        const {
            offerId,
            viaAPI,
            retryNumber,
        } = command.data;

        if (!viaAPI && retryNumber < constants.MAX_NUMBER_OF_RETRIES_FOR_PAYOUT) {
            this.logger.warn(`Rescheduling failed payout for offer ${offerId}. Attempt ${retryNumber}/${constants.MAX_NUMBER_OF_RETRIES_FOR_PAYOUT}. Schedule delay ${delay / 60000} minutes`);
            command.data.retryNumber += 1;
            return {
                commands: [
                    {
                        name: 'dhPayOutCommand',
                        data: command.data,
                        delay,
                    },
                ],
            };
        }
        return Command.empty();
    }

    /**
     * Print balances
     * @param blockchainIdentity
     * @param blockchain_id
     * @return {Promise<void>}
     * @private
     */
    async _printBalances(blockchainIdentity, blockchain_id) {
        const blockchain_title = this.blockchain.getBlockchainTitle(blockchain_id).response;

        const { node_wallet } = this.blockchain.getWallet(blockchain_id).response;
        const profile = await this.blockchain
            .getProfile(blockchainIdentity, blockchain_id).response;

        let walletBalance;
        if (blockchain_title !== constants.BLOCKCHAIN_TITLE.OriginTrailParachain) {
            walletBalance =
                await this.blockchain.getWalletTokenBalance(node_wallet, blockchain_id).response;
        } else {
            walletBalance =
                await this.blockchain.getWalletBaseBalance(node_wallet, blockchain_id).response;
        }
        const walletBalanceInTRAC = Blockchain.fromWei(blockchain_title, walletBalance, 'ether');
        this.logger.info(`Wallet balance: ${walletBalanceInTRAC} TRAC`);

        const profileBalance = profile.stake;
        const profileBalanceInTRAC = Blockchain.fromWei(blockchain_title, profileBalance, 'ether');
        this.logger.info(`Profile balance: ${profileBalanceInTRAC} TRAC`);
    }

    async _clearReplicationDatabaseData(offerId) {
        await Models.bids.destroy({
            where: {
                offer_id: offerId,
                status: 'COMPLETED',
            },
        });

        await Models.holding_data.destroy({
            where: {
                offer_id: offerId,
            },
        });
    }
    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhPayOutCommand',
            delay: 0,
            period: constants.PAYOUT_COMMAND_RETRY_DELAY_IN_MILISECONDS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhPayOutCommand;
