const Models = require('../../../models/index');
const Command = require('../command');

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
        this.transport = ctx.transport;
        this.notifyError = ctx.notifyError;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
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
            nodeId, wallet, id, data_set_id,
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

            let edges;
            let vertices;
            if (dataInfo.origin === 'HOLDING') { // DH has the data
                // Get replication key and then encrypt data.
                const holdingDataModels = await Models.holding_data.findAll({
                    where: { data_set_id: importId },
                });

                let holdingDataModel = null;
                if (holdingDataModels.length > 0) {
                    [holdingDataModel] = holdingDataModels; // take the first one
                }

                const encColor = holdingDataModel !== null ? holdingDataModel.color : null;
                const verticesPromise
                    = this.graphStorage.findVerticesByImportId(importId, encColor);
                const edgesPromise
                    = this.graphStorage.findEdgesByImportId(importId, encColor);

                [vertices, edges] = await Promise.all([verticesPromise, edgesPromise]);
                this.logger.important(JSON.stringify(vertices));
                this.logger.important(JSON.stringify(edges));
                ImportUtilities.unpackKeys(vertices, edges);

                const holdingData = holdingDataModel.get({ plain: true });
                const dataPublicKey = holdingData.litigation_public_key;

                Graph.decryptVertices(
                    vertices.filter(vertex => vertex.vertex_type !== 'CLASS'),
                    dataPublicKey,
                );
            } else { // DC or DV
                const verticesPromise = this.graphStorage.findVerticesByImportId(importId);
                const edgesPromise = this.graphStorage.findEdgesByImportId(importId);
                [vertices, edges] = await Promise.all([verticesPromise, edgesPromise]);
            }

            ImportUtilities.deleteInternal(edges);
            ImportUtilities.deleteInternal(vertices);

            const transactionHash = await ImportUtilities
                .getTransactionHash(dataInfo.data_set_id, dataInfo.origin);

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
                data_set_id: importId, // TODO: Temporal. Remove it.
                transaction_hash: transactionHash,
            };
            const dataReadResponseObject = {
                message: replyMessage,
                messageSignature: Utilities.generateRsvSignature(
                    JSON.stringify(replyMessage),
                    this.web3,
                    this.config.node_private_key,
                ),
            };

            await this.transport.sendDataReadResponse(dataReadResponseObject, nodeId);
        } catch (e) {
            const errorMessage = `Failed to process data read request. ${e}.`;
            this.logger.warn(errorMessage);
            this.notifyError(e);
            await this.transport.sendDataReadResponse({
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
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHDataReadRequestFreeCommand;
