const fs = require('fs');
const BN = require('bn.js');
const path = require('path');
const EthereumAbi = require('ethereumjs-abi');
const constants = require('../constants');

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
        const identities = this.blockchain.getAllIdentities();

        let promises = [];

        for (let i = 0; i < identities.length; i += 1) {
            const { response: identity, blockchain_id } = identities[i];

            promises.push(this.isProfileCreated(
                identity,
                blockchain_id,
            ));
        }

        const profiles = await Promise.all(promises);

        promises = [];

        for (let i = 0; i < identities.length; i += 1) {
            const { response: identity, blockchain_id } = identities[i];

            if (profiles[i]) {
                this.logger.notify(`Profile has already been created for node ${this.config.identity}, on blockchain: ${blockchain_id}`);
            } else {
                promises.push(this.createAndSaveNewProfile(
                    identity,
                    blockchain_id,
                ));
            }
        }

        await Promise.all(promises);
    }

    async createAndSaveNewProfile(profileIdentity, blockchainId) {
        const identityExists = !!profileIdentity;
        const profileMinStake = await this.blockchain.getProfileMinimumStake(blockchainId).response;
        this.logger.info(`Minimum stake for profile registration is ${profileMinStake}, for blockchain id: ${blockchainId}`);

        let initialTokenAmount = null;
        // todo move initial_deposit_amount into separated configuration
        if (this.config.initial_deposit_amount) {
            initialTokenAmount = new BN(this.config.initial_deposit_amount, 10);
        } else {
            initialTokenAmount = new BN(profileMinStake, 10);
        }

        let approvalIncreased = false;
        do {
            try {
                // eslint-disable-next-line no-await-in-loop
                await this.blockchain
                    .increaseProfileApproval(initialTokenAmount, blockchainId).response;
                approvalIncreased = true;
            } catch (error) {
                if (error.message.includes('Gas price higher than maximum allowed price')) {
                    this.logger.warn('Current average gas price is too high, to force profile' +
                        ' creation increase max_allowed_gas_price in your configuration file and reset the node.' +
                        ' Retrying in 30 minutes...');
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((resolve) => {
                        setTimeout(() => {
                            resolve();
                        }, constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS);
                    });
                } else {
                    throw error;
                }
            }
        } while (approvalIncreased === false);

        // set empty identity if there is none
        let identity = identityExists ? profileIdentity : new BN(0, 16);

        const { node_wallet, management_wallet } = this.blockchain.getWallet('ethr');
        let createProfileCalled = false;
        do {
            try {
                if (management_wallet) {
                    // eslint-disable-next-line no-await-in-loop
                    await this.blockchain.createProfile(
                        management_wallet,
                        this.config.identity,
                        initialTokenAmount, identityExists, identity,
                        blockchainId,
                    ).response;
                    createProfileCalled = true;
                } else {
                    this.logger.important('Management wallet not set. Creating profile with operating wallet only.' +
                        ' Please set management one.');
                    // eslint-disable-next-line no-await-in-loop
                    await this.blockchain.createProfile(
                        node_wallet,
                        this.config.identity,
                        initialTokenAmount, identityExists, identity,
                        blockchainId,
                    ).response;
                    createProfileCalled = true;
                }
            } catch (error) {
                if (error.message.includes('Gas price higher than maximum allowed price')) {
                    this.logger.warn('Current average gas price is too high, to force profile' +
                        ' creation increase max_allowed_gas_price in your configuration file and reset the node.' +
                        ' Retrying in 30 minutes...');
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((resolve) => {
                        setTimeout(() => {
                            resolve();
                        }, constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS);
                    });
                } else {
                    throw error;
                }
            }
        } while (createProfileCalled === false);

        if (!identityExists) {
            const event = await this.blockchain.subscribeToEvent(
                'IdentityCreated',
                null,
                5 * 60 * 1000,
                null,
                eventData =>
                    Utilities.compareHexStrings(eventData.profile, node_wallet),
                null,
                blockchainId,
            );

            if (event) {
                this.blockchain.saveIdentity(event.newIdentity, blockchainId);
                this.logger.notify(`Identity created for node ${this.config.identity}. Identity is ${event.newIdentity}. For blockchain id: ${blockchainId}.`);
            } else {
                throw new Error('Identity could not be confirmed in timely manner. Please, try again later.');
            }
        }


        identity = this.getIdentity(blockchainId);
        const event = await this.blockchain.subscribeToEvent(
            'ProfileCreated',
            null,
            5 * 60 * 1000,
            null,
            eventData =>
                Utilities.compareHexStrings(eventData.profile, identity),
            null,
            blockchainId,
        );
        if (event) {
            this.logger.notify(`Profile created for node ${this.config.identity}. For blockchain id: ${blockchainId} the profile identifier is ${identity}.`);
        } else {
            throw new Error('Profile could not be confirmed in timely manner. Please, try again later.');
        }
    }

    /**
     * Is profile created
     * @returns {Promise<boolean>}
     */
    async isProfileCreated(identity, blockchainId) {
        if (!identity) {
            return false;
        }

        const profile = await this.blockchain.getProfile(identity, blockchainId).response;

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
     * Initiates payout opertaion
     * @param offerId
     * @param urgent
     * @return {Promise<void>}
     */
    async payOut(offerId, urgent) {
        await this.commandExecutor.add({
            name: 'dhPayOutCommand',
            delay: 0,
            transactional: false,
            data: {
                urgent,
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
     * Check if ERC725 has valid node ID. If not it updates node id on contract
     */
    async validateAndUpdateProfiles() {
        const identities = this.blockchain.getAllIdentities();

        let promises = [];
        for (let i = 0; i < identities.length; i += 1) {
            const { response: identity, blockchain_id } = identities[i];

            promises.push(this.blockchain.getProfile(identity, blockchain_id).response);
        }

        const profiles = await Promise.all(promises);

        promises = [];

        for (let i = 0; i < identities.length; i += 1) {
            const { response: identity, blockchain_id } = identities[i];
            const profile = profiles[i];

            if (!profile.nodeId.toLowerCase().startsWith(`0x${this.config.identity.toLowerCase()}`)) {
                this.logger.important(`${profile.nodeId} does not match with ${this.config.identity.toLowerCase()}`);
                promises.push(this.blockchain.setNodeId(
                    identity,
                    Utilities.normalizeHex(this.config.identity.toLowerCase()),
                    blockchain_id,
                ).response);
            }
        }

        await Promise.all(promises);
    }

    getIdentity(blockchainId) {
        return Utilities.normalizeHex(this.blockchain.getIdentity(blockchainId).response);
    }
}

module.exports = ProfileService;
