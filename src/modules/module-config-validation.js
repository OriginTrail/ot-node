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
            throw new Error(`Missing validation for ${capitalizedName}`);
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

    validateBlockchainEvents(config) {
        const occurences = {};
        for (const implementation of Object.values(config.implementation)) {
            // eslint-disable-next-line no-continue
            if (!implementation.enabled) {
                continue;
            }

            if (implementation.config.blockchains.length === 0) {
                throw new Error(
                    'Blockchains must be specified in the blockchain events service config.',
                );
            }

            if (
                implementation.config.blockchains.length >
                Object.keys(implementation.config.rpcEndpoints).length
            ) {
                throw new Error('Missing RPC edpoints in the blockchain events service config.');
            }

            if (
                implementation.config.blockchains.length >
                Object.keys(implementation.config.hubContractAddress).length
            ) {
                throw new Error('Missing hub addresses in the blockchain events service config.');
            }

            for (const blockchain of implementation.config.blockchains) {
                if (!occurences[blockchain]) {
                    occurences[blockchain] = 0;
                }
                occurences[blockchain] += 1;

                if (occurences[blockchain] > 1) {
                    throw new Error(
                        `Exactly one blockchain events service for blockchain ${blockchain} needs to be defined.`,
                    );
                }

                if (
                    !implementation.config.rpcEndpoints[blockchain] ||
                    implementation.config.rpcEndpoints[blockchain].length === 0
                ) {
                    throw new Error(
                        `RPC endpoint is not defined for blockchain: ${blockchain} in the blockchain events service config.`,
                    );
                }

                if (!implementation.config.hubContractAddress[blockchain]) {
                    throw new Error(
                        `Hub contract address is not defined for blockchain: ${blockchain} in the blockchain events service config.`,
                    );
                }
            }
        }
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
                throw new Error(
                    `Exactly one config for repository ${repository} needs to be defined.`,
                );
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
