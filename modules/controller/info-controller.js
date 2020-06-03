const pjson = require('../../package.json');

class InfoController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
    }

    async getNodeInfo(req, res) {
        this.logger.api('GET: Node information request received.');

        try {
            const network = await this.transport.getNetworkInfo();

            const numberOfVertices = await this.graphStorage.getDocumentsCount('ot_vertices');
            const numberOfEdges = await this.graphStorage.getDocumentsCount('ot_edges');

            const basicConfig = {
                version: pjson.version,
                blockchain: this.config.blockchain.blockchain_title,
                network,
                is_bootstrap: this.config.is_bootstrap_node,
                graph_size: {
                    number_of_vertices: numberOfVertices,
                    number_of_edges: numberOfEdges,
                },
            };

            if (!this.config.is_bootstrap_node) {
                Object.assign(basicConfig, {
                    node_wallet: this.config.node_wallet,
                    erc_725_identity: this.config.erc725Identity,
                });
            }

            res.status(200);
            res.send(basicConfig);
        } catch (error) {
            this.logger.error(`Failed to process /api/info route. ${error}`);
            res.status(500);
            res.send({
                message: error,
            });
        }
    }
}

module.exports = InfoController;

