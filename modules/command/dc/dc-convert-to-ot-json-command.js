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
        this.web3 = ctx.web3;
        this.importService = ctx.importService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { standard_id, documentPath, handler_id } = command.data;
        try {
            if (standard_id === 'ot-json') {
                let document = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));

                if (!document.signature) {
                    document = ImportUtilities.prepareDataset(document);
                }

                fs.writeFileSync(documentPath, JSON.stringify(document));

                return this.continueSequence(command.data, command.sequence);
            }
            await this.importWorkerController.startOtjsonConverterWorker(command, standard_id);
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
