class AbstractPlugin {
    /**
     * Initialize plugin
     * @param config
     */
    initialize(config) {
        // pass
    }

    /**
     * Executes plugin code
     * @param data - Plugin data
     * @return {Promise<void>}
     */
    async execute(data) {
        // pass
    }
}

module.exports = AbstractPlugin;
