const Command = require('../command');

class DcConvertToOtJson extends Command {
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
        const { standard_id, document, handler_id } = command.data;
        let otJsonDoc;
        // TODO Implement other standards converting
        if (standard_id === 'gs1') {
            otJsonDoc = this.epcisOtJsonTranspiler.convertToOTJson(document);
        }
        return this.continueSequence(this.pack({ otJsonDoc, handler_id }), command.sequence);
    }

    pack(data) {
        Object.assign(data, {
            document: data.otJsonDoc,
            handler_id: data.handler_id,
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
            name: 'dcConvertToOtJsonCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcConvertToOtJson;
