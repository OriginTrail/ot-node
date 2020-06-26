const Models = require('../../../models/index');
const Command = require('../command');

const Utilities = require('../../Utilities');
const ImportUtilities = require('../../ImportUtilities');
const Graph = require('../../Graph');

const constants = require('../../constants');

/**
 * Free read request command.
 */
class DHDataReadRequestFreeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.config = ctx.config;
        this.web3 = ctx.web3;
        this.transport = ctx.transport;
        this.importService = ctx.importService;
        this.permissionedDataService = ctx.permissionedDataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            message,
        } = command.data;

        const {
            nodeId, wallet, id, data_set_id, handler_id,
        } = message;
        try {
            // Check is it mine offer.
            const networkReplyModel = await Models.network_replies.find({ where: { id } });
            if (!networkReplyModel) {
                throw Error(`Couldn't find reply with ID ${id}.`);
            }

            if (networkReplyModel.receiver_wallet !== wallet &&
                networkReplyModel.receiver_identity) {
                throw Error('Sorry not your read request');
            }

            // TODO: Only one import ID used. Later we'll support replication from multiple imports.
            // eslint-disable-next-line
            const importId = data_set_id;
            const dataInfo = await Models.data_info.findOne({
                where: {
                    data_set_id: importId,
                },
            });

            if (!dataInfo) {
                throw Error(`Failed to get data info for import ID ${importId}.`);
            }

            const document = await this.importService.getImport(importId);

            const permissionedData = await this.permissionedDataService.getAllowedPermissionedData(
                document,
                nodeId,
            );


            ImportUtilities.removeGraphPermissionedData(document['@graph']);

            const transactionHash = await ImportUtilities
                .getTransactionHash(dataInfo.data_set_id, dataInfo.origin);

            const replyMessage = {
                id,
                wallet: this.config.node_wallet,
                nodeId: this.config.identity,
                data_provider_wallet: dataInfo.data_provider_wallet,
                agreementStatus: 'CONFIRMED',
                document,
                permissionedData,
                data_set_id: importId,
                transaction_hash: transactionHash,
                handler_id,
            };
            const dataReadResponseObject = {
                message: replyMessage,
                messageSignature: Utilities.generateRsvSignature(
                    replyMessage,
                    this.web3,
                    this.config.node_private_key,
                ),
            };

            await this.transport.sendDataReadResponse(dataReadResponseObject, nodeId);
        } catch (e) {
            const errorMessage = `Failed to process data read request. ${e}.`;
            this.logger.warn(errorMessage);
            await this.transport.sendDataReadResponse({
                status: 'FAIL',
                message: errorMessage,
                messageSignature: Utilities.generateRsvSignature(
                    errorMessage,
                    this.web3,
                    this.config.node_private_key,
                ),
            }, nodeId);
        }

        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhDataReadRequestFreeCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHDataReadRequestFreeCommand;
