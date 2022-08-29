/* eslint-disable import/extensions */
import { NETWORK_PROTOCOLS } from '../constants/constants.js';

class RpcRouter {
    constructor(ctx) {
        this.networkModuleManager = ctx.networkModuleManager;
        this.logger = ctx.logger;

        this.publishController = ctx.publishController;
        this.getController = ctx.getController;
    }

    async initialize() {
        await this.initializeListeners();
    }

    async initializeListeners() {
        this.networkModuleManager.handleMessage(NETWORK_PROTOCOLS.STORE, (message, remotePeerId) =>
            this.publishController.handleNetworkStoreRequest(message, remotePeerId),
        );

        this.networkModuleManager.handleMessage(NETWORK_PROTOCOLS.GET, (message, remotePeerId) =>
            this.getController.handleNetworkGetRequest(message, remotePeerId),
        );
    }
}

export default RpcRouter;
