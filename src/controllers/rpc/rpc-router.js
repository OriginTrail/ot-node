class RpcRouter {
    constructor(ctx) {
        this.networkModuleManager = ctx.networkModuleManager;
        this.protocolService = ctx.protocolService;
        this.logger = ctx.logger;

        this.publishRpcController = ctx.publishRpcController;
        this.getRpcController = ctx.getRpcController;
    }

    async initialize() {
        this.initializeListeners();
    }

    initializeListeners() {
        for (const protocol of this.protocolService.getProtocols()) {
            const version = this.protocolService.toAwilixVersion(protocol);
            const operation = this.protocolService.toOperation(protocol);
            const handleRequest = this.protocolService.isLatest(protocol)
                ? `handleRequest`
                : `${version}handleRequest`;
            const controller = `${operation}RpcController`;

            this.networkModuleManager.handleMessage(protocol, (message, remotePeerId) =>
                this[controller][handleRequest](message, remotePeerId, protocol),
            );
        }
    }
}

export default RpcRouter;
