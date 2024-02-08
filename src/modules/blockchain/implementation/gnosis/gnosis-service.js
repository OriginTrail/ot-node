import axios from 'axios';
import { setTimeout as sleep } from 'timers/promises';
import Web3Service from '../web3-service.js';
import {
    BLOCK_TIME_MILLIS,
    GNOSIS_DEFAULT_GAS_PRICE,
    NODE_ENVIRONMENTS,
} from '../../../../constants/constants.js';

class GnosisService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'GNO';
        this.tracTicker = 'TRAC';
    }

    getBlockTimeMillis() {
        return BLOCK_TIME_MILLIS.GNOSIS;
    }

    async getGasPrice() {
        try {
            const response = await axios.get(this.config.gasPriceOracleLink);
            let gasPrice;
            if (this.config.name.split(':')[1] === '100') {
                gasPrice = Number(response.data.result, 10);
            } else if (this.config.name.split(':')[1] === '10200') {
                gasPrice = Math.round(response.data.average * 1e9);
            }
            this.logger.debug(`Gas price on Gnosis: ${gasPrice}`);
            return gasPrice;
        } catch (error) {
            const defaultGasPrice =
                process.env.NODE_ENV === NODE_ENVIRONMENTS.MAINNET
                    ? GNOSIS_DEFAULT_GAS_PRICE.MAINNET
                    : GNOSIS_DEFAULT_GAS_PRICE.TESTNET;
            this.logger.warn(
                `Failed to fetch the gas price from the Gnosis: ${error}. Using default value: ${defaultGasPrice} Gwei.`,
            );
            this.convertToWei(defaultGasPrice, 'gwei');
        }
    }

    async healthCheck() {
        try {
            const blockNumber = await this.getBlockNumber();
            if (blockNumber) return true;
        } catch (e) {
            this.logger.error(`Error on checking Gnosis blockchain. ${e}`);
            return false;
        }
        return false;
    }

    async createProfile(peerId) {
        if (!this.config.sharesTokenName || !this.config.sharesTokenSymbol) {
            throw new Error(
                'Missing sharesTokenName and sharesTokenSymbol in blockchain configuration. Please add it and start the node again.',
            );
        }

        const maxNumberOfRetries = 3;
        let retryCount = 0;
        let profileCreated = false;
        const retryDelayInSec = 12;
        while (retryCount + 1 <= maxNumberOfRetries && !profileCreated) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await this._executeContractFunction(this.ProfileContract, 'createProfile', [
                    this.getManagementKey(),
                    this.convertAsciiToHex(peerId),
                    this.config.sharesTokenName,
                    this.config.sharesTokenSymbol,
                    this.config.operatorFee,
                ]);
                this.logger.info(
                    `Profile created with name: ${this.config.sharesTokenName} and symbol: ${this.config.sharesTokenSymbol}`,
                );
                profileCreated = true;
            } catch (error) {
                if (error.message.includes('Profile already exists')) {
                    this.logger.info(`Skipping profile creation, already exists on blockchain.`);
                    profileCreated = true;
                } else if (retryCount + 1 < maxNumberOfRetries) {
                    retryCount += 1;
                    this.logger.warn(
                        `Unable to create profile. Will retry in ${retryDelayInSec}s. Retries left: ${
                            maxNumberOfRetries - retryCount
                        }`,
                    );
                    // eslint-disable-next-line no-await-in-loop
                    await sleep(retryDelayInSec * 1000);
                } else {
                    throw error;
                }
            }
        }
    }
}

export default GnosisService;
