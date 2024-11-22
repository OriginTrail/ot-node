import { REQUIRED_MODULES, TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

class ModuleConfigValidation {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    validateModule(name, config) {
        this.validateRequiredModule(name, config);
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        if (typeof this[`validate${capitalizedName}`] === 'function') {
            this[`validate${capitalizedName}`](config);
        } else {
            throw Error(`Missing validation for ${capitalizedName}`);
        }
    }

    validateAutoUpdater() {
        return true;
    }

    validateBlockchain() {
        return true;
    }

    validateHttpClient() {
        return true;
    }

    validateNetwork() {
        return true;
    }

    validateRepository() {
        return true;
    }

    validateBlockchainEvents() {
        return true;
    }

    validateTripleStore(config) {
        const occurences = {};
        for (const implementation of Object.values(config.implementation)) {
            // eslint-disable-next-line no-continue
            if (!implementation.enabled) {
                continue;
            }

            for (const repository in implementation.config.repositories) {
                if (!occurences[repository]) {
                    occurences[repository] = 0;
                }
                occurences[repository] += 1;
            }
        }
        for (const repository of Object.values(TRIPLE_STORE_REPOSITORIES)) {
            if (occurences[repository] !== 1) {
                throw Error(`Exactly one config for repository ${repository} needs to be defined.`);
            }
        }
    }

    validateValidation() {
        return true;
    }

    validateRequiredModule(moduleName, moduleConfig) {
        if (
            !moduleConfig?.enabled ||
            !Object.values(moduleConfig.implementation).filter(
                (implementationConfig) => implementationConfig.enabled,
            ).length
        ) {
            const message = `${moduleName} module not defined or enabled in configuration`;
            if (REQUIRED_MODULES.includes(moduleName)) {
                throw new Error(`${message} but it's required!`);
            }
            this.logger.warn(message);
        }
    }

    validateTelemetry() {
        return true;
    }
}

export default ModuleConfigValidation;
