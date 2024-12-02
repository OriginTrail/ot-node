import BaseModuleManager from '../base-module-manager.js';

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

    async sendTelemetryData(operationId, timestamp, blockchainId, name, value1, value2, value3) {
        if (this.initialized) {
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
