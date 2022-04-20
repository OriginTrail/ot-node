const OTAutoUpdater = require('./implementation/ot-auto-updater');

class AutoUpdaterModuleInterface {
    constructor(config) {
        this.config = config;
    }

    initialize() {
        this.implementation = new OTAutoUpdater(this.config);
        return this.implementation.initialize(this.config.logger);
    }

    async compareVersions() {
        return this.implementation.compareVersions();
    }

    async update() {
        return this.implementation.forceUpdate();
    }
};

module.exports = AutoUpdaterModuleInterface;
