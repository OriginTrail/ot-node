const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

class DcAfterImport extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importer = ctx.importer;
        this.emitter = ctx.emitter;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { afterImportData } = command.data;
        const response = await this.importer.afterImport(afterImportData);
        response.handler_id = afterImportData.handler_id;
        return this.continueSequence({ response, error: null }, command.sequence);
    }

    pack(data) {
        Object.assign(data, {
            response: data,
            error: null,
        });
        return data;
    }

    /**
     * Builds default dcOfferCreateDbCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcAfterImportCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcAfterImport;
