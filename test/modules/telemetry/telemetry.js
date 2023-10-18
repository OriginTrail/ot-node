import { readFile } from 'fs/promises';
import { describe, it, before } from 'mocha';
import { assert } from 'chai';
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

    describe('Listen on events', () => {
        it('Event emitter on method called', async () => {
            const eventEmitterMock = {
                on: (eventName) => {
                    assert.equal(eventName, 'operation_status_changed');
                },
            };

            telemetryModuleManager = new TelemetryModuleManager({
                logger,
                config,
                eventEmitterMock,
            });
            await telemetryModuleManager.initialize();
            telemetryModuleManager.listenOnEvents(() => {});
        });
    });
});
