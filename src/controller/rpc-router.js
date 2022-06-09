const constants = require('../../modules/constants');

class RpcRouter {
    constructor(ctx) {
        this.networkModuleManager = ctx.networkModuleManager;
        this.logger = ctx.logger;

        this.publishController = ctx.publishController;
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

        // this.networkModuleManager.handleMessage(constants.NETWORK_PROTOCOLS.RESOLVE, (result) =>
        //     this.queryService.handleResolve(result),
        // );
        //
        // this.networkModuleManager.handleMessage(
        //     constants.NETWORK_PROTOCOLS.SEARCH,
        //     (result) => this.queryService.handleSearch(result),
        //     {
        //         async: true,
        //         timeout: constants.NETWORK_HANDLER_TIMEOUT,
        //     },
        // );
        //
        // this.networkModuleManager.handleMessage(constants.NETWORK_PROTOCOLS.SEARCH_RESULT, (result) =>
        //     this.queryService.handleSearchResult(result),
        // );
        //
        // this.networkModuleManager.handleMessage(
        //     constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS,
        //     (result) => this.queryService.handleSearchAssertions(result),
        //     {
        //         async: true,
        //         timeout: constants.NETWORK_HANDLER_TIMEOUT,
        //     },
        // );
        //
        // this.networkModuleManager.handleMessage(
        //     constants.NETWORK_PROTOCOLS.SEARCH_ASSERTIONS_RESULT,
        //     (result) => this.queryService.handleSearchAssertionsResult(result),
        // );
    }
}

module.exports = RpcRouter;
