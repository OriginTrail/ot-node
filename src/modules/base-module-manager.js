const requiredModules = [
    'repository',
    'httpClient',
    'network',
    'validation',
    'blockchain',
    'tripleStore',
];

class BaseModuleManager {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    async initialize() {
        try {
            const moduleConfig = this.config.modules[this.getName()];
            if (!moduleConfig || !moduleConfig.enabled) {
                const message = `${this.getName()} module not defined or enabled in configuration`;
                if (requiredModules.includes(this.getName())) {
                    throw new Error(`${message} but it's required!`);
                }
                this.logger.warn(message);
                return false;
            }

            this.handlers = {};
            for (const implementationName in moduleConfig.implementation) {
                if (
                    moduleConfig.defaultImplementation &&
                    implementationName !== moduleConfig.defaultImplementation
                ) {
                    // eslint-disable-next-line no-continue
                    continue;
                }
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
                await module.initialize(implementationConfig.config, this.logger, this.config);
                this.logger.info(
                    `${this.getName()} module initialized with implementation: ${implementationName}`,
                );
                this.handlers[implementationName] = {
                    module,
                    config: implementationConfig,
                };
            }
            if (Object.keys(this.handlers).length === 0) {
                throw new Error(`No implementation initialized for module: ${this.getName()}.`);
            }
            this.initialized = true;
            return true;
        } catch (error) {
            if (requiredModules.includes(this.getName())) {
                throw new Error(
                    `Module is required but got error during initialization - ${error.message}`,
                );
            }
            this.logger.error(error.message);
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

    getImplementationsNames() {
        return Object.keys(this.handlers);
    }

    removeImplementation(name = null) {
        const keys = Object.keys(this.handlers);
        if (keys.length === 1 || !name) {
            delete this.handlers[keys[0]];
        }
        delete this.handlers[name];
    }
}

module.exports = BaseModuleManager;
