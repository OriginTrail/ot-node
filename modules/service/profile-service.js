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

        let initialTokenAmount = null;
        if (this.config.initial_deposit_amount) {
            initialTokenAmount = new BN(this.config.initial_deposit_amount, 10);
        } else {
            initialTokenAmount = new BN(profileMinStake, 10);
        }

        await this.blockchain.increaseProfileApproval(initialTokenAmount);

        // set empty identity if there is none
        const identity = this.config.erc725Identity ? this.config.erc725Identity : new BN(0, 16);

        if (this.config.management_wallet) {
            await this.blockchain.createProfile(
                this.config.management_wallet,
                this.config.identity,
                initialTokenAmount, identityExists, identity,
            );
        } else {
            this.logger.important('Management wallet not set. Creating profile with operating wallet only.' +
                    ' Please set management one.');
            await this.blockchain.createProfile(
                this.config.node_wallet,
                this.config.identity,
                initialTokenAmount, identityExists, identity,
            );
        }
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
        if (!this.config.erc725Identity) {
            throw Error('ProfileService not initialized.');
        }

        const profile = await this.blockchain.getProfile(this.config.erc725Identity);

        const zero = new BN(0);
        const stake = new BN(profile.stake, 10);
        const stakeReserved = new BN(profile.stakeReserved, 10);
        const reputation = new BN(profile.reputation, 10);
        const withdrawalTimestamp = new BN(profile.withdrawalTimestamp, 10);
        const withdrawalAmount = new BN(profile.withdrawalAmount, 10);
        const nodeId = new BN(Utilities.denormalizeHex(profile.nodeId), 16);
        return !(stake.eq(zero) && stakeReserved.eq(zero) &&
            reputation.eq(zero) && withdrawalTimestamp.eq(zero) &&
            withdrawalAmount.eq(zero) && nodeId.eq(zero));
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
                viaAPI: true,
            },
        });
        this.logger.notify(`Pay-out for offer ${offerId} initiated.`);
    }

    /**
     * Deposit token to profile
     * @param amount
     * @deprecated
     * @returns {Promise<void>}
     */
    async depositTokens(amount) {
        throw new Error('OT Node does not support deposit functionality anymore');
    }

    /**
     * Withdraw tokens from profile to identity
     * @param amount
     * @deprecated
     * @return {Promise<void>}
     */
    async withdrawTokens(amount) {
        throw new Error('OT Node does not support withdrawal functionality anymore');
    }

    /**
     * Check for ERC725 identity version and executes upgrade of the profile.
     * @return {Promise<void>}
     */
    async upgradeProfile() {
        if (await this.blockchain.isErc725IdentityOld(this.config.erc725Identity)) {
            this.logger.important('Old profile detected. Upgrading to new one.');
            try {
                const result = await this.blockchain.transferProfile(
                    this.config.erc725Identity,
                    this.config.management_wallet,
                );
                const newErc725Identity =
                    Utilities.normalizeHex(result.logs[result.logs.length - 1].data.substr(
                        result.logs[result.logs.length - 1].data.length - 40,
                        40,
                    ));

                this.logger.important('**************************************************************************');
                this.logger.important(`Your ERC725 identity has been upgraded and now has the new address: ${newErc725Identity}`);
                this.logger.important('Please backup your ERC725 identity file.');
                this.logger.important('**************************************************************************');
                this.config.erc725Identity = newErc725Identity;
                this._saveIdentity(newErc725Identity);
            } catch (transferError) {
                throw Error(`Failed to transfer profile. ${transferError}. ${transferError.stack}`);
            }
        }
    }
}

module.exports = ProfileService;
