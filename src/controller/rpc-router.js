class RpcRouter {
    constructor(ctx) {
        this.networkModuleManager = ctx.networkModuleManager;
        this.logger = ctx.logger;

        this.publishController = ctx.publishController;
        this.getController = ctx.getController;
        this.searchController = ctx.searchController;

        this.protocolVersion = '1.0.1';
    }

    async initialize() {
        await this.initializeListeners();
    }

    async initializeListeners() {
        this.networkModuleManager.handleMessage(
            `/store/${this.protocolVersion}`,
            (message, remotePeerId) =>
                this.publishController.handleNetworkStoreRequest(message, remotePeerId),
        );

        this.networkModuleManager.handleMessage(
            `/get/${this.protocolVersion}`,
            (message, remotePeerId) =>
                this.getController.handleNetworkGetRequest(message, remotePeerId),
        );

        this.networkModuleManager.handleMessage(
            `/search/assertions/${this.protocolVersion}`,
            (message, remotePeerId) =>
                this.searchController.handleNetworkSearchAssertionsRequest(message, remotePeerId),
        );
    }
}

module.exports = RpcRouter;
