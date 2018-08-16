const Models = require('../../../models/index');
const Command = require('../command');

const BN = require('bn.js');
const Utilities = require('../../Utilities');
const ImportUtilities = require('../../ImportUtilities');
const Graph = require('../../Graph');

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
        this.network = ctx.network;
        this.notifyError = ctx.notifyError;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            message,
        } = command.data;

        /*
            message: {
                id: REPLY_ID,
                import_id: IMPORT_ID,
                wallet: DH_WALLET,
                nodeId: KAD_ID
            }
        */

        // TODO in order to avoid getting a different import.
        const {
            nodeId, wallet, id, import_id,
        } = message;
        try {
            // Check is it mine offer.
            const networkReplyModel = await Models.network_replies.find({ where: { id } });
            if (!networkReplyModel) {
                throw Error(`Couldn't find reply with ID ${id}.`);
            }

            const offer = networkReplyModel.data;

            if (networkReplyModel.receiver_wallet !== wallet &&
                networkReplyModel.receiver_identity) {
                throw Error('Sorry not your read request');
            }

            // TODO: Only one import ID used. Later we'll support replication from multiple imports.
            // eslint-disable-next-line
            const importId = import_id;

            const verticesPromise = this.graphStorage.findVerticesByImportId(importId);
            const edgesPromise = this.graphStorage.findEdgesByImportId(importId);

            const values = await Promise.all([verticesPromise, edgesPromise]);
            const vertices = values[0];
            const edges = values[1];

            ImportUtilities.unpackKeys(vertices, edges);

            const dataInfo = await Models.data_info.findOne({
                where: {
                    import_id: importId,
                },
            });

            if (!dataInfo) {
                throw Error(`Failed to get data info for import ID ${importId}.`);
            }

            ImportUtilities.deleteInternal(vertices);

            // Get replication key and then encrypt data.
            const holdingDataModel = await Models.holding_data.find({ where: { id: importId } });

            if (holdingDataModel) {
                const holdingData = holdingDataModel.get({ plain: true });
                const dataPublicKey = holdingData.data_public_key;
                const replicationPrivateKey = holdingData.distribution_private_key;

                Graph.decryptVertices(
                    vertices.filter(vertex => vertex.vertex_type !== 'CLASS'),
                    dataPublicKey,
                );
            }

            /*
            dataReadResponseObject = {
                message: {
                    id: REPLY_ID
                    wallet: DH_WALLET,
                    nodeId: KAD_ID
                    agreementStatus: CONFIRMED/REJECTED,
                    data_provider_wallet,
                    encryptedData: { … }
                },
                messageSignature: {
                    c: …,
                    r: …,
                    s: …
               }
            }
             */

            const replyMessage = {
                id,
                wallet: this.config.node_wallet,
                nodeId: this.config.identity,
                data_provider_wallet: dataInfo.data_provider_wallet,
                agreementStatus: 'CONFIRMED',
                data: {
                    vertices,
                    edges,
                },
                import_id: importId, // TODO: Temporal. Remove it.
            };
            const dataReadResponseObject = {
                message: replyMessage,
                messageSignature: Utilities.generateRsvSignature(
                    JSON.stringify(replyMessage),
                    this.web3,
                    this.config.node_private_key,
                ),
            };

            await this.network.kademlia().sendDataReadResponse(dataReadResponseObject, nodeId);
        } catch (e) {
            const errorMessage = `Failed to process data read request. ${e}.`;
            this.logger.warn(errorMessage);
            this.notifyError(e);
            await this.network.kademlia().sendDataReadResponse({
                status: 'FAIL',
                message: errorMessage,
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
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHDataReadRequestFreeCommand;
