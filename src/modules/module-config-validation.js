import { REQUIRED_MODULES, TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

class ModuleConfigValidation {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    validateModule(name, config) {
        this.validateRequiredModule(name, config);
        if (!config.enabled) return;

        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        this[`validate${capitalizedName}`](config);
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

    validateTripleStore(config) {
        const occurences = {};
        for (const implementation of Object.values(config.implementation)) {
            // eslint-disable-next-line no-continue
            if (!implementation.enabled) continue;

            for (const repository in implementation.config.repositories) {
                if (!occurences[repository]) occurences[repository] = 0;
                occurences[repository] += 1;
            }
        }
        for (const repository of Object.values(TRIPLE_STORE_REPOSITORIES)) {
            if (occurences[repository] !== 1) return false;
        }
        return true;
    }

    validateValidation() {
        return true;
    }

    validateRequiredModule(moduleName, moduleConfig) {
        if (!moduleConfig?.enabled) {
            const message = `${moduleName} module not defined or enabled in configuration`;
            if (REQUIRED_MODULES.includes(moduleName)) {
                throw new Error(`${message} but it's required!`);
            }
            this.logger.warn(message);
            return false;
        }
    }
}

export default ModuleConfigValidation;
