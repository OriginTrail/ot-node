const { fork } = require('child_process');
const ImportUtilities = require('../ImportUtilities');

class ImportWorkerController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.web3 = ctx.web3;
        this.importerService = ctx.importerService;

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
        this.logger.info('Starting graph converter worker');
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

        await this.importerService.validateDocument(document);

        const forked = fork('modules/worker/graph-converter-worker.js');

        forked.send(JSON.stringify({
            document, encryptedMap, wallet, handler_id,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                await this._sendErrorToFinalizeCommand(response.error, handler_id);
                forked.kill();
                return;
            }
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
            forked.kill();
        });
    }

    async startOtjsonConverterWorker(command, standardId) {
        this.logger.info('Starting ot-json converter worker');
        const { document, handler_id } = command.data;

        const forked = fork('modules/worker/otjson-converter-worker.js');

        forked.send(JSON.stringify({ config: this.config, dataset: document, standardId }));

        forked.on('message', async (response) => {
            if (response.error) {
                await this._sendErrorToFinalizeCommand(response.error, handler_id);
                forked.kill();
                return;
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
            forked.kill();
        });
    }

    async _sendErrorToFinalizeCommand(error, handler_id) {
        await this.commandExecutor.add({
            name: 'dcFinalizeImportCommand',
            delay: 0,
            transactional: false,
            data: {
                error: { message: error.message },
                handler_id,
            },
        });
    }
}
module.exports = ImportWorkerController;
