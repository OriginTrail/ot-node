import { NETWORK_PROTOCOLS } from '../../constants/constants.js';

class RpcRouter {
    constructor(ctx) {
        this.networkModuleManager = ctx.networkModuleManager;
        this.protocolService = ctx.protocolService;
        this.logger = ctx.logger;

        this.v1_0_1PublishRpcController = ctx.v1_0_1PublishRpcController;
        this.v1_0_0PublishRpcController = ctx.v1_0_0PublishRpcController;
        this.v1_0_0GetRpcController = ctx.v1_0_0GetRpcController;
    }

    async initialize() {
        await this.initializeListeners();
    }

    async initializeListeners() {
        NETWORK_PROTOCOLS.STORE.forEach((protocol) => {
            const controllerVersion = this.protocolService.toAwilixVersion(protocol);
            const controller = `${controllerVersion}PublishRpcController`;

            this.networkModuleManager.handleMessage(protocol, (message, remotePeerId) =>
                this[controller].handleRequest(message, remotePeerId, protocol),
            );
        });

        NETWORK_PROTOCOLS.GET.forEach((protocol) => {
            const controllerVersion = this.protocolService.toAwilixVersion(protocol);
            const controller = `${controllerVersion}GetRpcController`;

            this.networkModuleManager.handleMessage(protocol, (message, remotePeerId) =>
                this[controller].handleRequest(message, remotePeerId, protocol),
            );
        });
    }
}

export default RpcRouter;
