const {
    describe, before, beforeEach, it,
} = require('mocha');
const GasPriceService = require('../../../modules/service/gas-price-service');
const awilix = require('awilix');
const defaultConfig = require('../../../config/config.json').mariner;
const rc = require('rc');
const pjson = require('../../../package.json');
const logger = require('../../../modules/logger');
const { assert } = require('chai');
const constants = require('../../../modules/constants');

let gasPriceService;
let axiosServiceMock;
let web3ServiceMock;

const defaultConfigGasPrice = 30000000000;
const defaultAxiosGasPrice = 20000000000;
const defaultWeb3GasPrice = 10000000000;
let config;

class AxiosServiceMock {
    constructor(logger) {
        this.logger = logger;
        this.gasPrice = defaultAxiosGasPrice;
        this.logger.debug('Axios service mock initialized');
    }

    async getGasPrice() {
        this.logger.debug('Returning axios service gas price');
        return this.gasPrice;
    }
}

class Web3Mock {
    constructor(logger) {
        this.logger = logger;
        this.eth = {
            gasPrice: defaultWeb3GasPrice,
            async getGasPrice() {
                return this.gasPrice;
            },
        };
    }
}

describe('Gas price service test', () => {
    beforeEach('Setup container', async () => {
        // Create the container and set the injectionMode to PROXY (which is also the default).
        process.env.NODE_ENV = 'mariner';
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        config = rc(pjson.name, defaultConfig);
        config.blockchain.gas_price = defaultConfigGasPrice;
        config.blockchain.gas_price_last_update_timestamp = 0;
        axiosServiceMock = new AxiosServiceMock(logger);
        web3ServiceMock = new Web3Mock(logger);
        container.register({
            config: awilix.asValue(config),
            logger: awilix.asValue(logger),
            axiosService: awilix.asValue(axiosServiceMock),
            web3: awilix.asValue(web3ServiceMock),
        });
        gasPriceService = new GasPriceService(container.cradle);
    });

    it('Get gas price - env is develop - expect default is returned', async () => {
        process.env.NODE_ENV = 'develop';
        const gasPrice = await gasPriceService.getGasPrice();
        assert.equal(gasPrice, defaultConfigGasPrice, 'Gas price should be the same as in config');
    });

    it('Get gas price - env is mariner, all services return valid value - expect axios value is used', async () => {
        const gasPrice = await gasPriceService.getGasPrice();
        assert.equal(gasPrice, defaultAxiosGasPrice * constants.AVERAGE_GAS_PRICE_MULTIPLIER, 'Returned gas price price should be the same as default axios gas price');
        assert.equal(config.blockchain.gas_price, defaultAxiosGasPrice * constants.AVERAGE_GAS_PRICE_MULTIPLIER, 'Configuration gas price should be the same as default axios gas price');
        const now = new Date().getTime();
        assert.closeTo(config.blockchain.gas_price_last_update_timestamp, now, 1000, 'Now should be set as new timestamp');
    });

    it('Get gas price - env is mariner, all services return valid value, timestamp is not older than 30 min - expect config value is used', async () => {
        const lastUpdateTimestamp = new Date().getTime() - (1000 * 25);
        config.blockchain.gas_price_last_update_timestamp = lastUpdateTimestamp;
        gasPriceService.config = config;
        const gasPrice = await gasPriceService.getGasPrice();
        assert.equal(gasPrice, config.blockchain.gas_price, 'Gas price should be the same as default config');
        assert.equal(config.blockchain.gas_price_last_update_timestamp, lastUpdateTimestamp, 'Timestamp should not be changed');
    });

    it('Get gas price - env is mariner, axios returns undefined - expect web3 value is used', async () => {
        axiosServiceMock.gasPrice = undefined;
        gasPriceService.axiosService = axiosServiceMock;
        const gasPrice = await gasPriceService.getGasPrice();
        assert.equal(gasPrice, defaultWeb3GasPrice * constants.AVERAGE_GAS_PRICE_MULTIPLIER, 'Gas price should be the same as default web3');
        assert.equal(config.blockchain.gas_price, defaultWeb3GasPrice * constants.AVERAGE_GAS_PRICE_MULTIPLIER, 'Gas price should be the same as default web3');
        const now = new Date().getTime();
        assert.closeTo(config.blockchain.gas_price_last_update_timestamp, now, 1000, 'Timestamp should not be changed');
    });

    it('Get gas price - env is mariner, web3 returns undefined - expect axios value is used', async () => {
        web3ServiceMock.eth.gasPrice = undefined;
        gasPriceService.web3 = web3ServiceMock;
        const gasPrice = await gasPriceService.getGasPrice();
        assert.equal(gasPrice, defaultAxiosGasPrice * constants.AVERAGE_GAS_PRICE_MULTIPLIER, 'Gas price should be the same as default axios');
        assert.equal(config.blockchain.gas_price, defaultAxiosGasPrice * constants.AVERAGE_GAS_PRICE_MULTIPLIER, 'Gas price should be the same as default axios');
        const now = new Date().getTime();
        assert.closeTo(config.blockchain.gas_price_last_update_timestamp, now, 1000, 'Timestamp should not be changed');
    });
});
