const Command = require('../command');
const Models = require('../../../models');
const ImportUtilities = require('../../ImportUtilities');
const constants = require('../../constants');

/**
 * Handles data location response.
 */
class DvPurchaseKeyDepositedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.remoteControl = ctx.remoteControl;
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.graphStorage = ctx.graphStorage;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        // todo limit purchase initiated commad repeat
        const events = await Models.events.findAll({
            where: {
                event: 'KeyRevealed',
                finished: 0,
            },
        });
        if (events) {
            const {
                handler_id,
                encoded_data,
                purchase_id,
                private_data_array_length,
                private_data_original_length,
            } = command.data;

            const event = events.find((e) => {
                const {
                    purchaseId,
                } = JSON.parse(e.data);
                return purchaseId === purchase_id;
            });
            if (event) {
                this.remoteControl.purchaseStatus('Purchase confirmed', 'Validating and storing data on your local node.');
                const { key } = JSON.parse(event.data);
                const decodedPrivateData = ImportUtilities
                    .validateAndDecodePrivateData(
                        encoded_data, key, private_data_array_length,
                        private_data_original_length,
                    );

                if (decodedPrivateData.errorStatus) {
                    const commandData = {
                        encoded_data,
                    };
                    await this.commandExecutor.add({
                        name: 'dvPurchaseDisputeCommand',
                        data: commandData,
                    });
                    return Command.empty();
                }

                const handler = await Models.handler_ids.findOne({
                    where: {
                        handler_id,
                    },
                });

                const {
                    data_set_id,
                    seller_node_id,
                    ot_object_id,
                } = JSON.parse(handler.data);

                await this._updatePrivateDataInDb(data_set_id, ot_object_id);

                await Models.data_trades.update({
                    status: 'COMPLETED', // todo validate status message
                    where: {
                        data_set_id,
                        ot_json_object_id: ot_object_id,
                        seller_node_id,
                    },
                });

                handler.status = 'COMPLETED';
                await handler.save({ fields: ['status'] });

                await Models.data_sellers.create({
                    data_set_id,
                    ot_json_object_id: ot_object_id,
                    seller_node_id: this.config.identity,
                    seller_erc_id: this.config.erc725Identity,
                    price: this.config.default_data_price,
                });

                this.remoteControl.purchaseStatus('Purchase completed', 'You can preview the purchased data in My Purchases page.');
                return Command.empty();
            }
        }
        return Command.retry();
    }

    /**
     * Builds default DvPurchaseKeyDepositedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvPurchaseKeyDepositedCommand',
            delay: 1 * 60 * 1000, // 5 min todo update to 5 min
            transactional: false,
            retries: 3,
        };
        Object.assign(command, map);
        return command;
    }

    async _updatePrivateDataInDb(dataSetId, otObjectId) {
        const otObject = await this.graphStorage.findDocumentsByImportIdAndOtObjectId(
            dataSetId,
            otObjectId,
        );
        const documentsToBeUpdated = [];
        otObject.relatedObjects.forEach((relatedObject) => {
            if (relatedObject.vertex.vertexType === 'Data') {
                if (this._validatePrivateDataRootHash(relatedObject.vertex.data)) {
                    documentsToBeUpdated.push(relatedObject.vertex);
                }
            }
        });

        const promises = [];
        documentsToBeUpdated.forEach((document) => {
            promises.push(this.graphStorage.updateDocument('ot_vertices', document));
        });
        await Promise.all(promises);
    }

    _validatePrivateDataRootHash(data) {
        let validated = false;
        constants.PRIVATE_DATA_OBJECT_NAMES.forEach((private_data_array) => {
            if (data[private_data_array] && Array.isArray(data[private_data_array])) {
                data[private_data_array].forEach((private_object) => {
                    if (private_object.isPrivate && private_object.data) {
                        const calculatedPrivateHash = ImportUtilities
                            .calculatePrivateDataHash(private_object);
                        validated = calculatedPrivateHash === private_object.private_data_hash;
                    }
                });
            }
        });
        return validated;
    }
}

module.exports = DvPurchaseKeyDepositedCommand;
