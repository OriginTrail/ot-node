const OTAutoUpdater = require('./implementation/ot-auto-updater');

class AutoUpdaterModuleInterface {
    constructor(config) {
        this.config = config;
        this.logger = config.logger;
    }

    initialize() {
        this.implementation = new OTAutoUpdater(this.config);
        return this.implementation.initialize(this.logger);
    }

    async compareVersions() {
        return this.implementation.compareVersions();
    }

    async update() {
        return this.implementation.update();
    }
};

module.exports = AutoUpdaterModuleInterface;
