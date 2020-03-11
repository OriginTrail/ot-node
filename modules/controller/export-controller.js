const Models = require('../../models');

/**
 * Encapsulates Export related methods
 */
class ExportController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.remoteControl = ctx.remoteControl;

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

        let standard_id;

        if (request.body.standard_id === undefined ||
            this.stanards.indexOf(request.body.standard_id) === -1) {
            standard_id = 'graph';
        } else {
            standard_id = request.body.standard_id.toLowerCase();
        }

        if (!this.mapping_standards_for_event.get(standard_id)) {
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
            },
        });
    }
}

module.exports = ExportController;

