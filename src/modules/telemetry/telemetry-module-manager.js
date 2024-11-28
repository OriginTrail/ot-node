import BaseModuleManager from '../base-module-manager.js';
import TelemetryQuest from './implementation/local-telemetry.js';

class TelemetryModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.eventEmitter = ctx.eventEmitter;
        this.telemetryQuest = new TelemetryQuest();
        this.telemetryQuest.initialize(ctx.config.modules.telemetry, ctx.logger); 
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
        if (this.initialized) {
            return this.telemetryQuest.sendEventTelemetry(
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
}

export default TelemetryModuleManager;
