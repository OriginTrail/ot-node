const appRootPath = require('app-root-path');

class BaseModuleManager {
    static EXCLUSIVE = 'exclusive';
    static PARALLEL = 'parallel';
    static SEQUENTIAL = 'sequential';

    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    initialize() {
        try {
            this.initialized = false;
            const moduleConfig = this.config[this.getName()];
            if (!moduleConfig || !moduleConfig.enabled) {
                this.logger.warn(`${this.getName()} module not defined or enabled in configuration`);
                return false;
            }

            if (!moduleConfig.packages || moduleConfig.packages.length > this.getPackagesLimit()) {
                this.logger.warn(`Packages for ${this.getName()} module are not defined or exceed limit`);
                return false;
            }


            this.handlers = [];
            moduleConfig.appRootPath = appRootPath.path;

            for (let i = 0; i < moduleConfig.packages.length; i += 1) {
                const module = require(moduleConfig.packages[i]);
                module.initialize(moduleConfig, this.logger);
                this.handlers.push({name: moduleConfig.packages[i], module});
            }

            this.initialized = true;
            return true;
        } catch (e) {
            this.logger.error(e);
            return false;
        }
    }
}

module.exports = BaseModuleManager;
