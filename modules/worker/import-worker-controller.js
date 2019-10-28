const { fork } = require('child_process');
const ImportUtilities = require('../ImportUtilities');

class ImportWorkerController {
    constructor(ctx) {
        this.logger = ctx.logger;
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
    async startGraphConverterWorker(command) {
        const {
            document,
            handler_id,
            encryptedMap,
        } = command.data;

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
            };

            await this.commandExecutor.add({
                name: command.sequence[0],
                sequence: command.sequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        });
    }

    async startOtjsonConverterWorker(command, standardId) {
        const { document, handler_id } = command.data;

        const forked = fork('modules/worker/otjson-converter-worker.js');

        forked.send(JSON.stringify({ config: this.config, dataset: document, standardId }));

        forked.on('message', async (response) => {
            if (response.error) {
                throw new Error(response.error);
            }
            const otjson = JSON.parse(response);
            const signedOtjson = ImportUtilities.signDataset(otjson, this.config, this.web3);
            const commandData = {
                document: signedOtjson,
                handler_id,
            };

            await this.commandExecutor.add({
                name: command.sequence[0],
                sequence: command.sequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        });
    }
}

module.exports = ImportWorkerController;
