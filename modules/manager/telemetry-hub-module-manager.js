const BaseModuleManager = require('./base-module-manager');

class TelemetryHubModuleManager extends BaseModuleManager {
    getName() {
        return 'telemetry_hub';
    }

    sendTelemetryData() {
        if (this.implementation) {
            this.implementation.sendTelemetryData();
        }
    }
}

module.exports = TelemetryHubModuleManager;
