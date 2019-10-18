const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

class ImportToOtjson extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.importer = ctx.importer;
        this.epcisOtJsonTranspiler = ctx.epcisOtJsonTranspiler;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { standard_id, document } = command.data;
        let otJsonDoc;
        if (standard_id === 'gs1') {
            otJsonDoc = this.epcisOtJsonTranspiler.convertToOTJson(document);
            // console.log(otJsonDoc);
        }
        return this.continueSequence({ data: otJsonDoc }, command.sequence);
    }

    pack(data) {
        Object.assign(data, { data });
        return data;
    }

    /**
     * Builds default dcOfferCreateDbCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcImportToOtJsonCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ImportToOtjson;
