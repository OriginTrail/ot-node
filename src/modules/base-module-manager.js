import ModuleConfigValidation from './module-config-validation.js';
import { REQUIRED_MODULES } from '../constants/constants.js';

class BaseModuleManager {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.moduleConfigValidation = new ModuleConfigValidation(ctx);
    }

    async initialize() {
        try {
            const moduleConfig = this.config.modules[this.getName()];
            this.moduleConfigValidation.validateModule(this.getName(), moduleConfig);

            this.handlers = {};
            this.initialized = true;
            for (const implementationName in moduleConfig.implementation) {
                if (!moduleConfig.implementation[implementationName].enabled) {
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

                implementationConfig.config.appDataPath = this.config.appDataPath;
                // eslint-disable-next-line no-await-in-loop
                const ModuleClass = (await import(implementationConfig.package)).default;
                const module = new ModuleClass();
                // eslint-disable-next-line no-await-in-loop
                if (this.getName() === 'telemetry') {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        await module.initialize(implementationConfig.config, this.logger);
                    } catch (error) {
                        this.logger.error(
                            `Could not initialize the ${this.getName()} module. Error: ${
                                error.message
                            }`,
                        );
                        this.initialized = false;
                        break;
                    }
                } else {
                    // eslint-disable-next-line no-await-in-loop
                    await module.initialize(implementationConfig.config, this.logger);
                }
                module.getImplementationName = () => implementationName;

                this.logger.info(
                    `${this.getName()} module initialized with implementation: ${implementationName}`,
                );
                this.handlers[implementationName] = {
                    module,
                    config: implementationConfig.config,
                };
            }

            return true;
        } catch (error) {
            if (REQUIRED_MODULES.includes(this.getName())) {
                throw new Error(
                    `${this.getName()} module is required but got error during initialization - ${
                        error.message
                    }`,
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

    getImplementationNames() {
        return Object.keys(this.handlers);
    }

    removeImplementation(name = null) {
        const keys = Object.keys(this.handlers);
        if (keys.length === 1 || !name) {
            delete this.handlers[keys[0]];
        }
        delete this.handlers[name];
    }

    getModuleConfiguration(name = null) {
        return this.getImplementation(name).config;
    }
}

export default BaseModuleManager;
