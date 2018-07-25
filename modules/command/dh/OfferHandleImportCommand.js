const Models = require('../../../models/index');
const Command = require('../Command');

const bytes = require('utf8-length');

class OfferCancelCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.importer = ctx.importer;
        this.blockchain = ctx.blockchain;
        this.network = ctx.network;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { data } = command.data;

        const bidModel = await Models.bids.findOne({ where: { import_id: data.import_id } });
        if (!bidModel) {
            this.log.warn(`Couldn't find bid for import ID ${data.import_id}.`);
            return;
        }
        let importResult = await this.importer.importJSON({
            import_id: data.import_id,
            vertices: data.vertices,
            edges: data.edges,
            wallet: data.dc_wallet,
        }, true);

        if (importResult.error) {
            throw Error(importResult.error);
        }

        importResult = importResult.response;

        const dataSize = bytes(JSON.stringify(importResult.vertices));
        await Models.data_info.create({
            import_id: importResult.import_id,
            total_documents: importResult.vertices.length,
            root_hash: importResult.root_hash,
            data_provider_wallet: importResult.wallet,
            import_timestamp: new Date(),
            data_size: dataSize,
        });

        this.log.trace(`[DH] Replication finished for ${data.import_id}`);
        return {
            commands: [
                {
                    name: 'offerReplicationParameters',
                    data: {
                        importId: data.import_id,
                    },
                },
            ],
        };
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'offerHandle',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OfferCancelCommand;
