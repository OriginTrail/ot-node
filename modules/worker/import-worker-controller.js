const fs = require('fs');
const { fork } = require('child_process');
const ImportUtilities = require('../ImportUtilities');
const bytes = require('utf8-length');
const OtJsonUtilities = require('../OtJsonUtilities');

class ImportWorkerController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.web3 = ctx.web3;
        this.importService = ctx.importService;
        this.blockchain = ctx.blockchain;

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
            documentPath,
            handler_id,
            encryptedMap,
            data_provider_wallet,
            purchased,
        } = command.data;

        let document = fs.readFileSync(documentPath, { encoding: 'utf-8' });
        const otjson_size_in_bytes = bytes(document);
        document = JSON.parse(document);
        // Extract wallet from signature.
        const wallet = ImportUtilities.extractDatasetSigner(
            document,
            this.web3,
        );

        await this.importService.validateDocument(document);

        const forked = fork('modules/worker/graph-converter-worker.js');

        forked.send(JSON.stringify({
            document, encryptedMap, wallet, handler_id,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                await this._sendErrorToFinalizeCommand(response.error, handler_id, documentPath);
                forked.kill();
                return;
            }
            const parsedData = JSON.parse(response);

            fs.writeFileSync(documentPath, JSON.stringify({
                vertices: parsedData.vertices,
                edges: parsedData.edges,
                metadata: parsedData.metadata,
            }));

            const commandData = {
                handler_id,
                documentPath,
                data_set_id: parsedData.datasetId,
                root_hash: parsedData.root_hash,
                data_hash: parsedData.data_hash,
                total_documents: parsedData.total_documents,
                otjson_size_in_bytes,
                data_provider_wallet,
                purchased,
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

    async startOtjsonConverterWorker(command, standardId, blockchain) {
        this.logger.info('Starting ot-json converter worker');
        const { documentPath, handler_id } = command.data;
        const document = fs.readFileSync(documentPath, { encoding: 'utf-8' });
        const forked = fork('modules/worker/otjson-converter-worker.js');

        forked.send(JSON.stringify({
            config: this.config, dataset: document, standardId, blockchain,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                await this._sendErrorToFinalizeCommand(response.error, handler_id, documentPath);
            } else {
                const otjson = response;

                const { node_private_key } = this.blockchain.getWallet().response;
                const signedOtjson = ImportUtilities.signDataset(otjson, node_private_key);
                fs.writeFileSync(documentPath, JSON.stringify(signedOtjson));
                const commandData = {
                    documentPath,
                    handler_id,
                };
                await this.commandExecutor.add({
                    name: command.sequence[0],
                    sequence: command.sequence.slice(1),
                    delay: 0,
                    data: commandData,
                    transactional: false,
                });
            }
            forked.kill();
        });
    }

    async _sendErrorToFinalizeCommand(error, handler_id, documentPath) {
        await this.commandExecutor.add({
            name: 'dcFinalizeImportCommand',
            delay: 0,
            transactional: false,
            data: {
                error: { message: error },
                handler_id,
                documentPath,
            },
        });
    }
}
module.exports = ImportWorkerController;
