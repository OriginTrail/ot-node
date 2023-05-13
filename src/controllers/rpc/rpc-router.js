class RpcRouter {
    constructor(ctx) {
        this.networkModuleManager = ctx.networkModuleManager;
        this.protocolService = ctx.protocolService;
        this.logger = ctx.logger;

        this.publishRpcController = ctx.publishRpcController;
        this.getRpcController = ctx.getRpcController;
        this.updateRpcController = ctx.updateRpcController;
    }

    initialize() {
        this.initializeListeners();
    }

    initializeListeners() {
        const protocols = this.protocolService.getProtocols().flatMap((p) => p);

        for (const protocol of protocols) {
            const version = this.protocolService.toAwilixVersion(protocol);
            const operation = this.protocolService.toOperation(protocol);
            const handleRequest = `${version}HandleRequest`;
            const controller = `${operation}RpcController`;

            this.networkModuleManager.handleMessageRequest(protocol, (message, remotePeerId) =>
                this[controller][handleRequest](message, remotePeerId, protocol),
            );
        }
    }
}

export default RpcRouter;
