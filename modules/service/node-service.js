class NodeService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    stop(exitCode) {
        this.logger.closeLogger('Stopping the node...');
        process.exit(exitCode);
    }
}

module.exports = NodeService;
