const { fork } = require('child_process');
const ImportUtilities = require('../ImportUtilities');

class ImportService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.web3 = ctx.web3;
        this.otJsonImporter = ctx.otJsonImporter;

        this.commandExecutor = ctx.commandExecutor;
        this.config = ctx.config;
    }

    /**
     * Call miner process
     * @param task
     * @param wallets
     * @param difficulty
     * @param offerId
     */
    async startGraphConverterWorker(data) {
        const {
            document,
            handler_id,
            encryptedMap,
        } = data;

        // Extract wallet from signature.
        const wallet = ImportUtilities.extractDatasetSigner(
            document,
            this.web3,
        );

        await this.otJsonImporter._validate(document);

        const forked = fork('modules/worker/graph-converter-worker.js');

        forked.send(JSON.stringify({
            document, encryptedMap, wallet, handler_id,
        }));

        forked.on('message', async (response) => {
            const parsedData = JSON.parse(response);
            const commandData = {
                parsedData,
            };
            Object.assign(commandData, {
                dbData: {
                    vertices: parsedData.vertices,
                    edges: parsedData.edges,
                    metadata: parsedData.metadata,
                    datasetId: parsedData.datasetId,
                    header: parsedData.header,
                    dataCreator: parsedData.dataCreator,
                },
                afterImportData: {
                    wallet: parsedData.wallet,
                    total_documents: parsedData.total_documents,
                    root_hash: parsedData.root_hash,
                    vertices: parsedData.deduplicateEdges,
                    edges: parsedData.deduplicateVertices,
                    data_set_id: parsedData.datasetId,
                    handler_id: parsedData.handler_id,
                },
            });

            const commandSequence = [
                'dcWriteToDbCommand',
                'dcAfterImportCommand',
                'dcFinalizeImportCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        });
    }

    async startOtjsonConverterWorker(data) {
        const {
            document,
            handler_id,
        } = data;

        /**
         * New sequence is created to avoid database operations for communication between commands
         */
        const forked = fork('modules/worker/otjson-converter-worker.js');

        const config = {
            blockchain: {
                network_id: this.config.blockchain.network_id,
                hub_contract_address: this.config.blockchain.hub_contract_address,
            },
            erc725Identity: this.config.erc725Identity,
        };

        forked.send(JSON.stringify({ config, xml: document }));

        forked.on('message', async (response) => {
            const otjson = JSON.parse(response);
            const signedOtjson = ImportUtilities.signDataset(otjson, this.config, this.web3);
            const commandData = {
                document: signedOtjson,
                handler_id,
            };

            const commandSequence = [
                'dcConvertToGraphCommand',
            ];
            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        });
    }
}

module.exports = ImportService;
