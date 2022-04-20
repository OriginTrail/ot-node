const OTAutoUpdater = require('./implementation/ot-auto-updater');

module.exports = class AutoUpdater {
    constructor(config) {
        this.config = config;
    }

    initialize() {
        this.implementation = new OTAutoUpdater(this.config);
        return this.implementation.initialize(this.config.logger);
    }

    async autoUpdate() {
        return this.implementation.autoUpdate();
    }

    async compareVersions() {
        return this.implementation.compareVersions();
    }

    async forceUpdate() {
        return this.implementation.forceUpdate();
    }
};
