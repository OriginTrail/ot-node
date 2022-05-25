const constants = require('../../modules/constants');

class BaseModuleManager {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    async initialize() {
        try {
            const moduleConfig = this.config.modules[this.getName()];
            if (!moduleConfig || !moduleConfig.enabled) {
                this.logger.warn(
                    `${this.getName()} module not defined or enabled in configuration`,
                );
                return false;
            }

            this.handlers = {};
            for (const implementationName in moduleConfig.implementation) {
                const implementationConfig = moduleConfig.implementation[implementationName];

                if (!implementationConfig) {
                    this.logger.warn(
                        `${implementationName} module implementation configuration not defined.`,
                    );
                    return false;
                }

                if (!implementationConfig.package) {
                    this.logger.warn(`Package for ${this.getName()} module is not defined`);
                    return false;
                }

                // eslint-disable-next-line global-require,import/no-dynamic-require
                const ModuleClass = require(implementationConfig.package);
                const module = new ModuleClass();
                // eslint-disable-next-line no-await-in-loop
                await module.initialize(implementationConfig.config, this.logger);
                this.logger.info(
                    `${this.getName()} module initialized with implementation: ${implementationName}`,
                );
                this.handlers[implementationName] = {
                    module,
                    config: implementationConfig,
                };
            }
            this.initialized = true;
            return true;
        } catch (e) {
            this.logger.error({
                msg: e.message,
                Event_name: constants.ERROR_TYPE.MODULE_INITIALIZATION_ERROR,
            });
            return false;
        }
    }

    getName() {
        throw new Error('Get name method not implemented in child class of base module interface.');
    }

    getImplementation(name = null) {
        const keys = Object.keys(this.handlers);
        if (keys.length === 1 || !name) {
            return this.handlers[keys[0]];
        }
        return this.handlers[name];
    }
}

module.exports = BaseModuleManager;
