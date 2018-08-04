const Models = require('../../../models/index');
const Command = require('../command');

/**
 * Handles data location response.
 */
class DVDataLocationResponseCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.network = ctx.network;
        this.web3 = ctx.web3;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            queryId,
            query,
            wallet,
            nodeId,
            imports,
            dataPrice,
            dataSize,
            stakeFactor,
            replyId,
        } = command.data;

        // Store the offer.
        const networkQueryResponse = await Models.network_query_responses.findOrCreate({
            where: { query_id: queryId, reply_id: replyId },
            defaults: {
                query: JSON.stringify(query),
                query_id: queryId,
                wallet,
                node_id: nodeId,
                imports: JSON.stringify(imports),
                data_price: dataPrice,
                stake_factor: stakeFactor,
                reply_id: replyId,
            },
        });

        // TODO: Fire socket notification for Houston

        if (!networkQueryResponse) {
            this.log.error(`Failed to add query response. Reply ID ${replyId}.`);
            throw Error('Internal error.');
        }

        this.remoteControl.networkQueryOfferArrived({
            query: JSON.stringify(query),
            query_id: queryId,
            wallet,
            node_id: nodeId,
            imports: JSON.stringify(imports),
            data_size: dataSize,
            data_price: dataPrice,
            stake_factor: stakeFactor,
            reply_id: replyId,
        });

        return Command.empty();
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            query: JSON.stringify(data.query),
            imports: JSON.stringify(data.imports),
        });
        return data;
    }

    /**
     * Unpack data from database
     * @param data
     * @returns {Promise<*>}
     */
    unpack(data) {
        const parsed = data;
        Object.assign(parsed, {
            query: JSON.parse(data.query),
            imports: JSON.parse(data.imports),
        });
        return parsed;
    }

    /**
     * Builds default DVDataLocationResponseCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvDataLocationResponseCommand',
            delay: 0,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DVDataLocationResponseCommand;
