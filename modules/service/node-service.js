class NodeService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    stop() {
        this.logger.closeLogger('Stopping the node...');
        process.exit(1);
    }
}

module.exports = NodeService;
