const pjson = require('../../package.json');
const Models = require('../../models/index');
const ImportUtilities = require('../ImportUtilities');

class InfoController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.config = ctx.config;
        this.graphStorage = ctx.graphStorage;
        this.profileService = ctx.profileService;
        this.blockchain = ctx.blockchain;
    }

    async getNodeInfo(req, res) {
        this.logger.api('GET: Node information request received.');

        try {
            const network = await this.transport.getNetworkInfo();

            const basicConfig = {
                version: pjson.version,
                network,
                is_bootstrap: this.config.is_bootstrap_node,
            };


            if (!this.config.is_bootstrap_node) {
                const numberOfVertices = await this.graphStorage.getDocumentsCount('ot_vertices');
                const numberOfEdges = await this.graphStorage.getDocumentsCount('ot_edges');

                const blockchain = this.getBlockchainInfo();

                Object.assign(basicConfig, {
                    blockchain,
                    graph_size: {
                        number_of_vertices: numberOfVertices,
                        number_of_edges: numberOfEdges,
                    },
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

    async getBlockchains(req, res) {
        this.logger.api('GET: Node blockchains request received.');

        try {
            if (!this.config.is_bootstrap_node) {
                const blockchain = this.getBlockchainInfo();
                res.status(200);
                res.send(blockchain);
            } else {
                res.status(200);
                res.send({
                    message: 'Node is running as bootstrap, no blockchain is initialized',
                });
            }
        } catch (error) {
            this.logger.error(`Failed to process /api/info route. ${error}`);
            res.status(500);
            res.send({
                message: error.toString(),
            });
        }
    }

    getBlockchainInfo() {
        const identityResponses = this.blockchain.getAllIdentities();
        const blockchain_info = [];
        for (const identityResponse of identityResponses) {
            const { blockchain_id, response: identity } = identityResponse;
            const { node_wallet } =
                this.blockchain.getWallet(blockchain_id).response;
            const blockchain_title =
                this.blockchain.getBlockchainTitle(blockchain_id).response;

            blockchain_info.push({
                blockchain_title,
                blockchain_id,
                node_wallet,
                identity,
            });
        }

        return blockchain_info;
    }

    async getDatasetInfo(request, response) {
        const datasetId = request.params.dataset_id;
        if (!datasetId) {
            response.status(400);
            response.send({
                message: 'Param dataset_id is required.',
            });
            return;
        }
        const dataInfo =
            await Models.data_info.findOne({ where: { data_set_id: datasetId } });

        if (!dataInfo) {
            this.logger.info(`Import data for data set ID ${datasetId} does not exist.`);
            response.status(404);
            response.send({
                message: `Import data for data set ID ${datasetId} does not exist`,
            });
            return;
        }

        const identities = await this.graphStorage.findIssuerIdentitiesForDatasetId(datasetId);

        if (!identities && identities.length > 0) {
            this.logger.info(`Issuer identity for data set ID ${datasetId} does not exist.`);
            response.status(404);
            response.send({
                message: `Import data for data set ID ${datasetId} does not exist`,
            });
            return;
        }

        const replicationInfo = await ImportUtilities
            .getReplicationInfo(datasetId, dataInfo.origin);

        const result = {
            dataset_id: datasetId,
            import_time: dataInfo.import_timestamp,
            dataset_size_in_bytes: dataInfo.data_size,
            otjson_size_in_bytes: dataInfo.otjson_size_in_bytes,
            root_hash: dataInfo.root_hash,
            data_hash: dataInfo.data_hash,
            total_graph_entities: dataInfo.total_documents,
            data_provider_wallets: JSON.parse(dataInfo.data_provider_wallets),
            data_creator_identities: identities,
            replication_info: replicationInfo,
        };

        response.status(200);
        response.send(result);
    }
}

module.exports = InfoController;

