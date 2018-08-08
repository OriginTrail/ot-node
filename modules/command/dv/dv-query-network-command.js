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
        const { queryId, query } = command.data;

        /*
            Expected dataLocationRequestObject:
            dataLocationRequestObject = {
                message: {
                    id: ID,
                    wallet: DV_WALLET,
                    nodeId: KAD_ID
                    query: [
                              {
                                path: _path,
                                value: _value,
                                opcode: OPCODE
                              },
                              ...
                    ]
                }
                messageSignature: {
                    v: …,
                    r: …,
                    s: …
                }
             }
         */

        await Models.network_queries.findOrCreate({
            where: { id: queryId },
            defaults: { id: queryId, query },
            transaction,
        });

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
                JSON.stringify(dataLocationRequestObject.message),
                this.web3,
                this.config.node_private_key,
            );

        this.network.kademlia().quasar.quasarPublish(
            'kad-data-location-request',
            dataLocationRequestObject,
            {},
            () => {
                this.logger.info(`Published query to the network. Query ID ${queryId}.`);
            },
        );

        return Command.empty();
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
