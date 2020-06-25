const Models = require('../../../models/index');
const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Queries the network for specific query.
 */
class DVQueryNetworkCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.transport = ctx.transport;
        this.web3 = ctx.web3;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const { queryId, query } = command.data;

        const networkQuery = await Models.network_queries.create({
            id: queryId,
            query,
        });
        if (!networkQuery) {
            throw Error('Failed to store network query.');
        }

        const dataLocationRequestObject = {
            message: {
                id: queryId,
                wallet: this.config.node_wallet,
                nodeId: this.config.identity,
                query,
            },
        };

        dataLocationRequestObject.messageSignature =
            Utilities.generateRsvSignature(
                dataLocationRequestObject.message,
                this.web3,
                this.config.node_private_key,
            );

        await this.transport.publish('kad-data-location-request', dataLocationRequestObject);
        this.logger.info(`Published query to the network. Query ID ${queryId}.`);
        return {
            commands: [
                {
                    name: 'dvHandleNetworkQueryResponsesCommand',
                    delay: 60000,
                    data: {
                        queryId,
                    },
                    transactional: false,
                },
            ],
        };
    }

    /**
     * Builds default DVQueryNetworkCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvQueryNetworkCommand',
            delay: 0,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DVQueryNetworkCommand;
