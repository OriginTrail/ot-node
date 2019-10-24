const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

class DcWriteToDbCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.otJsonImporter = ctx.otJsonImporter;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        await this.otJsonImporter.writeToDb({
            data: command.data.dbData,
        });

        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    pack(data) {
        Object.assign(data, {
            afterImportData: data.afterImportData,
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
            name: 'dcWriteToDbCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcWriteToDbCommand;
