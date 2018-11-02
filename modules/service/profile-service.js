const fs = require('fs');
const BN = require('bn.js');
const path = require('path');

const Utilities = require('../Utilities');

class ProfileService {
    /**
     * Default constructor
     * @param ctx
     */
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
        this.web3 = ctx.web3;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Initializes profile on the contract
     * Note: creates profile if there is none
     */
    async initProfile() {
        this._loadIdentity();

        let identityExists = false;
        if (this.config.erc725Identity) {
            identityExists = true;
            this.logger.notify(`Identity has already been created for node ${this.config.identity}. Identity is ${this.config.erc725Identity}.`);
        }

        if (identityExists && await this.isProfileCreated()) {
            this.logger.notify(`Profile has already been created for node ${this.config.identity}`);
            return;
        }

        const profileMinStake = await this.blockchain.getProfileMinimumStake();
        this.logger.info(`Minimum stake for profile registration is ${profileMinStake}`);

        await this.blockchain.increaseProfileApproval(new BN(profileMinStake, 10));

        // set empty identity if there is none
        const identity = this.config.erc725Identity ? this.config.erc725Identity : new BN(0, 16);
        await this.blockchain.createProfile(
            this.config.identity,
            new BN(profileMinStake, 10), identityExists, identity,
        );
        if (!identityExists) {
            const event = await this.blockchain.subscribeToEvent('IdentityCreated', null, 5 * 60 * 1000, null, eventData => Utilities.compareHexStrings(eventData.profile, this.config.node_wallet));
            if (event) {
                this._saveIdentity(event.newIdentity);
                this.logger.notify(`Identity created for node ${this.config.identity}. Identity is ${this.config.erc725Identity}.`);
            } else {
                throw new Error('Identity could not be confirmed in timely manner. Please, try again later.');
            }
        }
        const event = await this.blockchain.subscribeToEvent('ProfileCreated', null, 5 * 60 * 1000, null, eventData => Utilities.compareHexStrings(eventData.profile, this.config.erc725Identity));
        if (event) {
            this.logger.notify(`Profile created for node ${this.config.identity}.`);
        } else {
            throw new Error('Profile could not be confirmed in timely manner. Please, try again later.');
        }
    }

    /**
     * Is profile created
     * @returns {Promise<boolean>}
     */
    async isProfileCreated() {
        const profile = await this.blockchain.getProfile(this.config.erc725Identity);
        return !new BN(profile.stake, 10).eq(new BN(0, 10));
    }

    /**
     * Load ERC725 identity from file
     * @private
     */
    _loadIdentity() {
        const identityFilePath = path.join(
            this.config.appDataPath,
            this.config.erc725_identity_filepath,
        );
        if (fs.existsSync(identityFilePath)) {
            const content = JSON.parse(fs.readFileSync(identityFilePath).toString());
            this.config.erc725Identity = content.identity;
        }
    }

    /**
     * Save ERC725 identity to file
     * @param identity - ERC725 identity
     * @private
     */
    _saveIdentity(identity) {
        this.config.erc725Identity = Utilities.normalizeHex(identity);

        const identityFilePath = path.join(
            this.config.appDataPath,
            this.config.erc725_identity_filepath,
        );
        fs.writeFileSync(identityFilePath, JSON.stringify({
            identity,
        }));
    }

    /**
     * Initiates payout opertaion
     * @param offerId
     * @return {Promise<void>}
     */
    async payOut(offerId) {
        await this.commandExecutor.add({
            name: 'dhPayOutCommand',
            delay: 0,
            transactional: false,
            data: {
                offerId,
            },
        });
        this.logger.notify(`Pay-out for offer ${offerId} initiated.`);
    }

    /**
     * Deposit token to profile
     * @param amount
     * @returns {Promise<void>}
     */
    async depositTokens(amount) {
        const walletBalance = await Utilities.getTracTokenBalance(
            this.web3,
            this.config.node_wallet,
            this.blockchain.getTokenContractAddress(),
        );

        if (amount > parseFloat(walletBalance)) {
            throw new Error(`Wallet balance: ${walletBalance} TRAC`);
        }

        const mTRAC = this.web3.utils.toWei(amount.toString(), 'ether');
        await this.commandExecutor.add({
            name: 'profileApprovalIncreaseCommand',
            sequence: [
                'depositTokensCommand',
            ],
            delay: 0,
            data: {
                amount: mTRAC,
            },
            transactional: false,
        });
        this.logger.notify(`Deposit for amount ${amount} initiated.`);
    }

    /**
     * Withdraw tokens from profile to identity
     * @param amount
     * @return {Promise<void>}
     */
    async withdrawTokens(amount) {
        const mTRAC = this.web3.utils.toWei(amount.toString(), 'ether');
        await this.commandExecutor.add({
            name: 'tokenWithdrawalStartCommand',
            data: {
                amount: mTRAC,
            },
        });
        this.logger.info(`Token withdrawal started for amount ${amount}.`);
    }
}

module.exports = ProfileService;
