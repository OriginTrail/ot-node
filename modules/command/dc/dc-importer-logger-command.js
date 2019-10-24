const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

class ImportLogCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        // this.importer = ctx.importer;
        // this.epcisOtJsonTranspiler = ctx.epcisOtJsonTranspiler;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        // const { vertices, edges, metadata } = command.data;
        console.log('================');
        console.log(command.data);
        return this.continueSequence({}, command.sequence);
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcImporterLoggerCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ImportLogCommand;
