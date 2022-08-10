const constants = require('../constants/constants');

class RpcRouter {
    constructor(ctx) {
        this.networkModuleManager = ctx.networkModuleManager;
        this.logger = ctx.logger;

        this.publishController = ctx.publishController;
        this.getController = ctx.getController;
        this.searchController = ctx.searchController;
    }

    async initialize() {
        await this.initializeListeners();
    }

    async initializeListeners() {
        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.STORE,
            (message, remotePeerId) =>
                this.publishController.handleNetworkStoreRequest(message, remotePeerId),
        );

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.GET,
            (message, remotePeerId) =>
                this.getController.handleNetworkGetRequest(message, remotePeerId),
        );

        this.networkModuleManager.handleMessage(
            constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
            (message, remotePeerId) =>
                this.searchController.handleNetworkSearchAssertionsRequest(message, remotePeerId),
        );
    }
}

module.exports = RpcRouter;
