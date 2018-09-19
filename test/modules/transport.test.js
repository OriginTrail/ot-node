require('dotenv').config();

const {
    describe, beforeEach, it,
} = require('mocha');
const { assert } = require('chai');
const awilix = require('awilix');
const rc = require('rc');

const Transport = require('../../modules/network/transport');
const Utilities = require('../../modules/Utilities');
const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

const logger = Utilities.getLogger();

/**
 * Simple Kademlia node mock
 */
class NetworkMock {
    constructor(logger) {
        this.logger = logger;
        this.node = {
            counter: 0,

            /**
             * Gets number of retries
             * @returns {number}
             */
            async getCounter() {
                return this.counter;
            },

            /**
             * Always throws exception
             */
            async throwException() {
                this.counter += 1;
                logger.warn('I\'ll fail now');
                throw new Error('Nasty exception');
            },

            /**
             * Does literally nothing
             */
            async doNothing() {
                logger.debug('I\'ll exit now');
            },
        };
    }

    /**
     * 'Initializes' the mock
     */
    initialize() {
        this.logger.debug('Network initialized');
    }

    /**
     * 'Starts' the mock
     */
    start() {
        this.logger.debug('Network started');
    }
}

describe('Transport basic tests', () => {
    let transport;

    beforeEach('Setup container', async () => {
        // Create the container and set the injectionMode to PROXY (which is also the default).
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const config = rc(pjson.name, defaultConfig);

        container.register({
            config: awilix.asValue(config),
            logger: awilix.asValue(logger),
            kademlia: awilix.asValue(new NetworkMock(logger)),
            transport: awilix.asValue(Transport()),
        });
        transport = container.resolve('transport');
        await transport.init(container.cradle);
    });

    describe('Test normal execution', () => {
        it(
            'should correctly call one method without retries',
            // eslint-disable-next-line no-loop-func
            async () => {
                await transport.doNothing();

                assert.equal(await transport.getCounter(), 0, 'No retries happened');
            },
        );
    });

    describe('Test failing execution', () => {
        it(
            'should correctly retry upon failing method',
            // eslint-disable-next-line no-loop-func
            async () => {
                let error;
                try {
                    await transport.throwException();
                } catch (e) {
                    error = e;
                }

                assert.isNotNull(error);
                assert.equal(error.message, 'Nasty exception');
                assert.equal(await transport.getCounter(), 4, 'No retries happened');
            },
        ).timeout(10000);
    });
});
