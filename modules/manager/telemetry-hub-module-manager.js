const BaseModuleManager = require('./base-module-manager');

class TelemetryHubModuleManager extends BaseModuleManager {
    getName() {
        return 'telemetryHub';
    }

    getType() {
        return BaseModuleManager.SEQUENTIAL;
    }

    getPackagesLimit() {
        return 1;
    }

    async aggregateTelemetryData() {
        if (this.initialized) {
            return await this.handlers[0].module.aggregateTelemetryData();
        }
    }
}

module.exports = TelemetryHubModuleManager;
