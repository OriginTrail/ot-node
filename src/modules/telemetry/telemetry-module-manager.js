import BaseModuleManager from '../base-module-manager.js';
import questdb from './implementation/telemetry-quest.js';
class TelemetryModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.eventEmitter = ctx.eventEmitter;
    }

    getName() {
        return 'telemetry';
    }

    listenOnEvents(onEventReceived) {
        if (this.config.modules.telemetry.enabled && this.initialized) {
            return this.getImplementation().module.listenOnEvents(
                this.eventEmitter,
                onEventReceived,
            );
        }
    }

    async sendTelemetryData(nodeData, events) {
        if (this.initialized) {
            return this.getImplementation().module.sendTelemetryData(nodeData, events);
        }
    }
    async createEventRecord(
        operationId,
        blockchainId,
        name,
        timestamp,
        value1 = null,
        value2 = null,
        value3 = null,
    ) {
        return questdb.sendEventTelemetry(
            operationId,
            blockchainId,
            name,
            timestamp,
            value1,
            value2,
            value3,
    );
    }
}

export default TelemetryModuleManager;
