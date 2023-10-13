import BaseModuleManager from '../base-module-manager.js';

class TelemetryModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.eventEmitter = ctx.eventEmitter;
    }

    getName() {
        return 'telemetry';
    }

    async listenOnEvents(onEvenetRecived) {
        if (this.initialized) {
            return this.getImplementation().module.listenOnEvents(
                this.eventEmitter,
                onEvenetRecived,
            );
        }
    }

    async sendTelemetryData(nodeData, events) {
        if (this.initialized) {
            return this.getImplementation().module.sendTelemetryData(nodeData, events);
        }
    }
}

export default TelemetryModuleManager;