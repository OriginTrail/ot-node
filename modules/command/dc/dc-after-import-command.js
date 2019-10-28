const Command = require('../command');
const ImportUtilities = require('../../ImportUtilities');
const Graph = require('../../Graph');

class DcAfterImport extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { afterImportData } = command.data;
        const response = await this.afterImport(afterImportData);
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
     * Process successfull import
     * @param unpack  Unpack keys
     * @param result  Import result
     * @return {Promise<>}
     */
    afterImport(result, unpack = false) {
        this.remoteControl.importRequestData();
        let {
            vertices, edges,
        } = result;
        if (unpack) {
            ImportUtilities.unpackKeys(vertices, edges);
        }
        const {
            data_set_id, wallet, root_hash,
        } = result;

        edges = Graph.sortVertices(edges);
        vertices = Graph.sortVertices(vertices);

        return {
            data_set_id,
            root_hash,
            total_documents: 1,
            vertices,
            edges,
            wallet,
        };
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
