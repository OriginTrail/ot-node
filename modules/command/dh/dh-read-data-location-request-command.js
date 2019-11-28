const Models = require('../../../models/index');
const Command = require('../command');

const { Op } = Models.Sequelize;

const BN = require('bn.js');
const Utilities = require('../../Utilities');

/**
 * Saves generated parameters to the DB
 */
class DHReadDataLocationRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.config = ctx.config;
        this.web3 = ctx.web3;
        this.transport = ctx.transport;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            msgNodeId, msgWallet, msgQuery, msgId,
        } = command.data;

        // Check if mine publish.
        if (msgNodeId === this.config.identity && msgWallet === this.config.node_wallet) {
            this.logger.trace('Received mine publish. Ignoring.');
            return Command.empty();
        }

        // Handle query here.
        const graphImports = await this.graphStorage.findImportIds(msgQuery);
        // Filter imports not stored in local DB.
        let imports = await Models.data_info.findAll({
            attributes: ['data_set_id'],
            where: {
                data_set_id: {
                    [Op.in]: graphImports,
                },
            },
        });

        if (!imports || imports.length === 0) {
            // I don't want to participate
            this.logger.trace(`No imports found for request ${msgId}`);
            return Command.empty();
        }

        // Convert to string array.
        imports = imports.map(i => i.data_set_id);

        // Check if the import came from network. In more details I can only
        // distribute data gotten from someone else.
        const replicatedImportIds = [];
        // Then check if I bought replication from another DH.
        const data_holders = await Models.holding_data.findAll({
            where: {
                id: {
                    [Op.in]: imports,
                },
            },
        });

        if (data_holders) {
            data_holders.forEach((data_holder) => {
                replicatedImportIds.push(data_holder.id);
            });
        }

        const wallet = this.config.node_wallet;
        const nodeId = this.config.identity;
        const dataPrice = 100000; // TODO add to configuration

        // TODO: Temporarily allow sending raw data (free read).
        // Merge with all imports
        imports.forEach((importId) => {
            if (!replicatedImportIds.includes(importId)) {
                replicatedImportIds.push(importId);
            }
        });

        const dataInfos = await Models.data_info.findAll({
            where: {
                data_set_id: {
                    [Op.in]: replicatedImportIds,
                },
            },
        });
        var size = 0;
        const importObjects = replicatedImportIds.map((dataSetId) => {
            size = dataInfos.find(di => di.data_set_id === dataSetId).otjson_size_in_bytes;
            return {
                data_set_id: dataSetId,
                size,
                calculated_price: new BN(size, 10).mul(new BN(dataPrice, 10)).toString(),
            };
        });

        if (importObjects.length === 0) {
            this.logger.trace(`Didn't find imports for query ${JSON.stringify(msgQuery)}.`);
            return Command.empty();
        }

        const networkReplyModel = await Models.network_replies.create({
            data: {
                id: msgId,
                imports: importObjects,
                dataPrice,
                stakeFactor: this.config.read_stake_factor,
            },
            receiver_wallet: msgWallet,
            receiver_identity: msgNodeId,
        });

        if (!networkReplyModel) {
            this.logger.error('Failed to create new network reply model.');
            throw Error('Internal error.');
        }

        const messageResponse = {
            id: msgId,
            replyId: networkReplyModel.id,
            wallet,
            nodeId,
            imports: importObjects,
            dataPrice,
            dataSize: size,
            stakeFactor: this.config.read_stake_factor,
        };

        const messageResponseSignature =
            Utilities.generateRsvSignature(
                JSON.stringify(messageResponse),
                this.web3,
                this.config.node_private_key,
            );

        const dataLocationResponseObject = {
            message: messageResponse,
            messageSignature: messageResponseSignature,
        };

        await this.transport.sendDataLocationResponse(
            dataLocationResponseObject,
            msgNodeId,
        );
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhReadDataLocationRequestCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHReadDataLocationRequestCommand;
