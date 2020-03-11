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
        this.stanards = ['OT-JSON', 'GS1-EPCIS', 'GRAPH', 'WOT'];
        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('ot-json', 'ot-json');
        this.mapping_standards_for_event.set('gs1-epcis', 'gs1');
        this.mapping_standards_for_event.set('graph', 'ot-json');
        this.mapping_standards_for_event.set('wot', 'wot');
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

        let standardId;

        if (request.body.standard_id === undefined ||
            this.stanards.indexOf(request.body.standard_id) === -1) {
            standardId = 'ot-json';
        } else {
            standardId = request.body.standard_id.toLowerCase();
        }

        if (!this.mapping_standards_for_event.get(standardId)) {
            response.status(400);
            response.send({
                message: 'Standard ID not supported',
            });
        }


        if (request.body.dataset_id === undefined) {
            response.status(400);
            response.send({
                message: 'Bad request dataset_id is not provided',
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

        await this.commandExecutor.add({
            name: 'exportCommand',
            transactional: false,
            data: {
                handlerId: handler_id,
                datasetId,
                standardId,
            },
        });
    }

    async checkForHandlerStatus(request, response) {
        const handlerId = request.params.handler_id;
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
        const { data, status } = handler_object;

        if (handler_object.status === 'COMPLETED') {
            const cacheDirectory = path.join(this.config.appDataPath, 'export_cache');
            const filePath = path.join(cacheDirectory, handlerId);

            const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
            const dataset = JSON.parse(fileContent);
            response.status(200);
            response.send({
                data: dataset,
                status,
            });
        } else {
            response.status(200);
            response.send({
                data: JSON.parse(data),
                status,
            });
        }
    }
}

module.exports = ExportController;

