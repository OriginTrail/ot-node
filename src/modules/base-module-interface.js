class BaseModuleInterface {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    initialize() {
        try {
            const moduleConfig = this.config.modules[this.getName()];
            if (!moduleConfig || !moduleConfig.enabled) {
                this.logger.warn(
                    `${this.getName()} module not defined or enabled in configuration`,
                );
                return false;
            }
            if (!moduleConfig.packages || moduleConfig.packages.length > this.getPackagesLimit()) {
                this.logger.warn(
                    `Packages for ${this.getName()} module are not defined or exceed limit`,
                );
                return false;
            }

            this.handlers = [];

            for (let i = 0; i < moduleConfig.packages.length; i += 1) {
                // eslint-disable-next-line global-require,import/no-dynamic-require
                const ModuleClass = require(moduleConfig.packages[i]);
                const module = new ModuleClass();
                module.initialize(moduleConfig, this.logger);
                this.logger.info(
                    `${this.getName()} module initialized with package: ${
                        moduleConfig.packages[i]
                    }`,
                );
                this.handlers.push({ name: moduleConfig.packages[i], module });
            }

            this.initialized = true;
            return true;
        } catch (e) {
            this.logger.error(e);
            return false;
        }
    }

    getName() {
        throw new Error('Get name method not implemented in child class of base module interface.');
    }

    getPackagesLimit() {
        return 1;
    }
}

module.exports = BaseModuleInterface;
