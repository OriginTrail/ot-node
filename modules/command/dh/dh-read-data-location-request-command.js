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
        this.network = ctx.network;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            msgNodeId, msgWallet, msgQuery, msgId,
        } = command.data;

        // Check if mine publish.
        if (msgNodeId === this.config.identity && msgWallet === this.config.node_wallet) {
            this.log.trace('Received mine publish. Ignoring.');
            Command.empty();
        }

        // Handle query here.
        const imports = await this.graphStorage.findImportIds(msgQuery);
        if (imports.length === 0) {
            // I don't want to participate
            this.log.trace(`No imports found for request ${msgId}`);
            Command.empty();
        }

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

        const dataInfos = await Models.data_info.findAll({
            where: {
                import_id: {
                    [Op.in]: replicatedImportIds,
                },
            },
        });

        const importObjects = replicatedImportIds.map((importId) => {
            const size = dataInfos.find(di => di.import_id === importId).data_size;
            return {
                import_id: importId,
                size,
                calculated_price: new BN(size, 10).mul(new BN(dataPrice, 10)).toString(),
            };
        });

        if (importObjects.length === 0) {
            this.logger.warn(`Zero import size for IDs ${JSON.stringify(replicatedImportIds)}.`);
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
        }, { transaction });

        if (!networkReplyModel) {
            this.log.error('Failed to create new network reply model.');
            throw Error('Internal error.');
        }

        const messageResponse = {
            id: msgId,
            replyId: networkReplyModel.id,
            wallet,
            nodeId,
            imports: importObjects,
            dataPrice,
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

        await this.network.kademlia().sendDataLocationResponse(
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
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHReadDataLocationRequestCommand;
