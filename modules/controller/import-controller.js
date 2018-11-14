const utilities = require('../Utilities');

class ImportController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.emitter = ctx.emitter;
        this.apiUtilities = ctx.apiUtilities;
    }

    /**
     * Validate import request and import
     * @param req   HTTP request
     * @param res   HTTP response
     */
    async import(req, res) {
        this.logger.api('POST: Import of data request received.');

        if (!this.apiUtilities.authorize(req, res)) {
            return;
        }

        if (req.body === undefined) {
            res.status(400);
            res.send({
                message: 'Bad request',
            });
            return;
        }

        const supportedImportTypes = ['GS1', 'WOT'];

        // Check if import type is valid
        if (req.body.importtype === undefined ||
            supportedImportTypes.indexOf(req.body.importtype) === -1) {
            res.status(400);
            res.send({
                message: 'Invalid import type',
            });
            return;
        }

        const importtype = req.body.importtype.toLowerCase();

        // Check if file is provided
        if (req.files !== undefined && req.files.importfile !== undefined) {
            const inputFile = req.files.importfile.path;
            try {
                const content = await utilities.fileContents(inputFile);
                const queryObject = {
                    content,
                    contact: req.contact,
                    replicate: req.body.replicate,
                    response: res,
                };
                this.emitter.emit(`api-${importtype}-import-request`, queryObject);
            } catch (e) {
                res.status(400);
                res.send({
                    message: 'No import data provided',
                });
            }
        } else if (req.body.importfile !== undefined) {
            // Check if import data is provided in request body
            const queryObject = {
                content: req.body.importfile,
                contact: req.contact,
                replicate: req.body.replicate,
                response: res,
            };
            this.emitter.emit(`api-${importtype}-import-request`, queryObject);
        } else {
            // No import data provided
            res.status(400);
            res.send({
                message: 'No import data provided',
            });
        }
    }

    /**
     * Gets data set information
     * @param req
     * @param res
     */
    async dataSetInfo(req, res) {
        this.logger.api('GET: import_info.');

        if (!this.apiUtilities.authorize(req, res)) {
            return;
        }

        const queryObject = req.query;
        if (queryObject.data_set_id == null) {
            res.send({ status: 400, message: 'Missing parameter!', data: [] });
            return;
        }

        this.emitter.emit('api-import-info', {
            dataSetId: queryObject.data_set_id,
            response: res,
        });
    }
}

module.exports = ImportController;
