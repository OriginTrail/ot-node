const Models = require('../../models');
const path = require('path');
const fs = require('fs');

/**
 * Encapsulates Export related methods
 */
class ExportController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.remoteControl = ctx.remoteControl;
        this.config = ctx.config;
        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('OT-JSON', 'ot-json');
        this.mapping_standards_for_event.set('GS1-EPCIS', 'gs1');
        this.mapping_standards_for_event.set('GRAPH', 'ot-json');
        this.mapping_standards_for_event.set('WOT', 'wot');
    }

    async exportDataset(request, response) {
        this.logger.api('POST: Export of data request received.');

        if (request.body === undefined) {
            response.status(400);
            response.send({
                message: 'Bad request',
            });
            return;
        }
        var standardId = '';
        if (!request.body.standard_id) {
            standardId = 'ot-json';
        } else {
            standardId =
                this.mapping_standards_for_event.get(request.body.standard_id);
            if (!standardId) {
                response.status(400);
                response.send({
                    message: `Standard ID not supported. Supported IDs: ${this.mapping_standards_for_event.keys()}`,
                });
                return;
            }
        }


        if (request.body.dataset_id === undefined) {
            response.status(400);
            response.send({
                message: 'Bad request, dataset_id is not provided',
            });
        }
        const datasetId = request.body.dataset_id;
        const requested_dataset = await Models.data_info.findOne({
            where: {
                data_set_id: datasetId,
            },
        });

        if (requested_dataset === null) {
            response.status(400);
            response.send({
                message: 'Data set does not exist',
            });
            return;
        }

        const inserted_object = await Models.handler_ids.create({
            data: JSON.stringify({ datasetId }),
            status: 'PENDING',
        });

        const { handler_id } = inserted_object.dataValues;
        response.status(200);
        response.send({
            handler_id,
        });

        const commandSequence = [
            'exportDataCommand',
            'exportWorkerCommand',
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: {
                handlerId: handler_id,
                datasetId,
                standardId,
            },
            transactional: false,
        });
    }

    async checkForHandlerStatus(request, response) {
        const handlerId = request.params.handler_id;
        this.logger.api(`POST: Export result request received with handler id: ${handlerId}`);
        const handler_object = await Models.handler_ids.findOne({
            where: {
                handler_id: handlerId,
            },
        });

        if (!handler_object) {
            this.logger.info('Invalid request');
            response.status(404);
            response.send({
                message: 'Unable to find data with given parameters! handler_id is required!',
            });
            return;
        }
        const { status } = handler_object;
        const data = JSON.parse(handler_object.data);

        if (handler_object.status === 'COMPLETED' ||
            (data.readExport && data.export_status === 'COMPLETED')) {
            const cacheDirectory = path.join(this.config.appDataPath, 'export_cache');
            const filePath = path.join(cacheDirectory, handlerId);

            const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
            const dataset = JSON.parse(fileContent);

            response.status(200);
            response.send({
                data: {
                    formatted_dataset: dataset.formatted_dataset,
                    root_hash: data.root_hash,
                    data_hash: data.data_hash,
                    replication_info: data.replication_info,
                    data_creators: data.data_creators,
                    dc_node_wallets: data.dc_node_wallets,
                    offer_id: data.offer_id,
                    import_status: data.import_status,
                    export_status: data.export_status,
                },
                status,
            });
        } else {
            response.status(200);
            response.send({
                data,
                status,
            });
        }
    }
}

module.exports = ExportController;

