import { readFile } from 'fs/promises';
import { describe, it, before } from 'mocha';
import { expect, assert } from 'chai';
import Logger from '../../../src/logger/logger.js';
import TelemetryModuleManager from '../../../src/modules/telemetry/telemetry-module-manager.js';

let logger;
let telemetryModuleManager;
const config = JSON.parse(await readFile('./test/modules/telemetry/config.json'));

describe('Telemetry module', () => {
    before('Initialize telemetry module manager', () => {
        logger = new Logger('trace');
        logger.info = () => {};
    });

    describe('Your Test Suite', () => {
        it('should call onEventReceived when event is emitted', async () => {
            const eventEmitter = {
                eventListeners: {},

                on(eventName, callback) {
                    if (!this.eventListeners[eventName]) {
                        this.eventListeners[eventName] = [];
                    }
                    this.eventListeners[eventName].push(callback);
                },

                emit(eventName, ...args) {
                    if (this.eventListeners[eventName]) {
                        this.eventListeners[eventName].forEach((callback) => callback(...args));
                    }
                },
            };

            let callbackCalled = false;

            function onEventReceived() {
                callbackCalled = true;
            }

            telemetryModuleManager = new TelemetryModuleManager({ config, logger, eventEmitter });
            await telemetryModuleManager.initialize();
            telemetryModuleManager.listenOnEvents(onEventReceived);

            eventEmitter.emit('operation_status_changed');

            assert(expect(callbackCalled).to.be.true);
        });
    });
});
