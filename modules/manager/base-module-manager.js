class BaseModuleManager {
    constructor(ctx) {
        this.config = ctx.config.modules;
        this.logger = ctx.logger;
    }

    getName() {
        return null;
    }

    initialize() {
        this.moduleConfig = this.config[this.getName()];
        if (!this.moduleConfig && !this.moduleConfig.enabled) {
            console.log(`${this.getName()} module not defined or enabled in configuration`);
            return false;
        }
        // eslint-disable-next-line global-require,import/no-dynamic-require
        const Module = require(this.moduleConfig.npmDependency);
        this.implementation = new Module(this.logger);
        this.implementation.initialize(this.moduleConfig.config);
        return true;
    }
}

module.exports = BaseModuleManager;
