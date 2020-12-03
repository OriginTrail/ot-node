const path = require('path');
const fs = require('fs');
const Command = require('../command');
const ImportUtilities = require('../../ImportUtilities');

class DcConvertToOtJsonCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importWorkerController = ctx.importWorkerController;
        this.commandExecutor = ctx.commandExecutor;
        this.config = ctx.config;
        this.importService = ctx.importService;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { standard_id, documentPath, handler_id } = command.data;
        try {
            const blockchain = this._getBlockchainImplementationParameters();

            if (standard_id === 'ot-json') {
                let document = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));

                if (!document.signature) {
                    document = ImportUtilities.prepareDataset(document, this.config, blockchain);
                }

                fs.writeFileSync(documentPath, JSON.stringify(document));

                return this.continueSequence(command.data, command.sequence);
            }
            await this.importWorkerController.startOtjsonConverterWorker(
                command,
                standard_id,
                blockchain,
            );
        } catch (error) {
            await this.commandExecutor.add({
                name: 'dcFinalizeImportCommand',
                delay: 0,
                transactional: false,
                data: {
                    error: { message: error.message },
                    handler_id,
                    documentPath,
                },
            });
        }
        return Command.empty();
    }

    _getBlockchainImplementationParameters() {
        const result = [];
        const blockchainIdentities = this.blockchain.getAllIdentities();

        for (const responseObject of blockchainIdentities) {
            const { blockchain_id, response: identity } = responseObject;
            result.push({
                blockchain_id,
                identity,
                hub_contract_address:
                    this.blockchain.getHubContractAddress(blockchain_id).response,
                node_private_key:
                    this.blockchain.getWallet(blockchain_id).response.node_private_key,
            });
        }
        result.sort((a, b) => a.blockchain_id.localeCompare(b.blockchain_id));

        return result;
    }

    /**
     * Builds default dcConvertToOtJsonCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcConvertToOtJsonCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcConvertToOtJsonCommand;
