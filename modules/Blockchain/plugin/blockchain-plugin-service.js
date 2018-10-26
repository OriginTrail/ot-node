const camelCase = require('camel-case');

/**
 * Blockchain service bootstraps and caches known plugins
 */
class BlockchainPluginService {
    constructor(ctx) {
        this.ctx = ctx;
        this.plugins = {};
    }

    /**
     * Scan for enabled plugins
     */
    bootstrap() {
        const pluginsConfig = this.ctx.config.blockchain.plugins;
        if (!pluginsConfig) {
            return;
        }
        pluginsConfig.forEach((pluginConfig) => {
            const {
                name, provider, config, enabled,
            } = pluginConfig;

            if (!enabled) {
                return;
            }
            let plugin = this.plugins[name];
            if (plugin) {
                throw new Error(`Failed to register plugin ${name} for provider ${provider}. Plugin for ${name} is already defined.`);
            }
            plugin = this._get(name, provider);
            plugin.initialize(config);
            this.plugins[name] = plugin;
        });
    }

    /**
     * Execute specific plugin
     * @param name - Plugin name
     * @param data - Plugin data
     * @return {Promise<void>}
     */
    async execute(name, data) {
        const plugin = this.plugins[name];
        if (plugin == null) {
            return;
        }
        return this.plugins[name].execute(data);
    }

    /**
     * Get cached plugin
     * @param name - Plugin name
     * @param provider - Plugin provider (Hyperledger, etc.)
     * @private
     */
    _get(name, provider) {
        return this.ctx[camelCase(`${provider}-${name}`)];
    }
}

module.exports = BlockchainPluginService;
