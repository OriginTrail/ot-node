import BaseModuleManager from '../base-module-manager.js';

class TelemetryModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.eventEmitter = ctx.eventEmitter;
    }

    getName() {
        return 'telemetry';
    }

    async initialize() {
        await super.initialize();

        this.listenOnEvents((eventData) => {
            this.sendTelemetryData(
                eventData.operationId,
                eventData.timestamp,
                eventData.blockchainId,
                eventData.lastEvent,
                eventData.value1,
                eventData.value2,
                eventData.value3,
            );
        });
    }

    listenOnEvents(onEventReceived) {
        if (this.config.modules.telemetry.enabled && this.initialized) {
            return this.getImplementation().module.listenOnEvents(
                this.eventEmitter,
                onEventReceived,
            );
        }
    }

    async sendTelemetryData(operationId, timestamp, blockchainId, name, value1, value2, value3) {
        if (this.config.modules.telemetry.enabled && this.initialized) {
            return this.getImplementation().module.sendTelemetryData(
                operationId,
                timestamp,
                blockchainId,
                name,
                value1,
                value2,
                value3,
            );
        }
    }
}

export default TelemetryModuleManager;
