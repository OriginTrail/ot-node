const path = require('path');
const { MAX_FILE_SIZE, PUBLISH_METHOD } = require('../../../modules/constants');
const Utilities = require('../../../modules/utilities');
const BaseController = require('./base-controller');

const PublishAllowedVisibilityParams = ['public', 'private'];

class PublishController extends BaseController {
    constructor(ctx) {
        super();
        this.workerPool = ctx.workerPool;
        this.publishService = ctx.publishService;
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.commandExecutor = ctx.commandExecutor;
    }

    async handleHttpApiPublishRequest(req, res) {
        return this.handleHttpApiPublishMethod(req, res, PUBLISH_METHOD.PUBLISH);
    }

    handleHttpApiProvisionRequest(req, res) {
        return this.handleHttpApiPublishMethod(req, res, PUBLISH_METHOD.PROVISION);
    }

    handleHttpApiUpdateRequest(req, res) {
        return this.handleHttpApiPublishMethod(req, res, PUBLISH_METHOD.UPDATE);
    }

    async handleHttpApiPublishMethod(req, res, method) {
        const operationId = this.generateOperationId();
        this.logger.emit({
            msg: 'Started measuring execution of publish command',
            Event_name: 'publish_start',
            Operation_name: 'publish',
            Id_operation: operationId,
        });
        this.logger.emit({
            msg: 'Started measuring execution of check arguments for publishing',
            Event_name: 'publish_init_start',
            Operation_name: 'publish_init',
            Id_operation: operationId,
        });

        const validity = this.isRequestValid(req, true, true, true, true, false);

        if (!validity.isValid) {
            return this.returnResponse(res, validity.code, { message: validity.message });
        }

        const handlerObject = await this.generateHandlerId();

        const handlerId = handlerObject.handler_id;

        this.returnResponse(res, 202, {
            handler_id: handlerId,
        });

        this.logger.emit({
            msg: 'Finished measuring execution of check arguments for publishing',
            Event_name: 'publish_init_end',
            Operation_name: 'publish_init',
            Id_operation: operationId,
        });

        this.logger.emit({
            msg: 'Started measuring execution of preparing arguments for publishing',
            Event_name: 'publish_prep_args_start',
            Operation_name: 'publish_prep_args',
            Id_operation: operationId,
        });

        let fileContent;
        const fileExtension = '.json';
        if (req.files) {
            fileContent = req.files.file.data.toString();
        } else {
            fileContent = req.body.data;
        }
        const { ual } = req.body;

        const { visibility } = req.body;

        let keywords = [];
        if (req.body.keywords) {
            keywords = await this.workerPool.exec('JSONParse', [req.body.keywords.toLowerCase()]);
        }
        if (keywords.length > 10) {
            keywords = keywords.slice(0, 10);
            this.logger.warn(
                'Too many keywords provided, limit is 10. Publishing only to the first 10 keywords.',
            );
        }
        this.logger.emit({
            msg: 'Finished measuring execution of preparing arguments for publishing',
            Event_name: 'publish_prep_args_end',
            Operation_name: 'publish_prep_args',
            Id_operation: operationId,
        });

        const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

        const documentPath = await this.fileService.writeContentsToFile(
            handlerIdCachePath,
            handlerId,
            await this.workerPool.exec('JSONStringify', [fileContent]),
        );
        const commandData = {
            fileExtension,
            keywords,
            visibility,
            method,
            ual,
            handlerId,
            operationId,
            documentPath,
        };

        const commandSequence = [
            'prepareAssertionForPublish',
            'submitProofsCommand',
            'insertAssertionCommand',
            'sendAssertionCommand',
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }

    isRequestValid(
        req,
        validateFiles = true,
        validateFileSize = true,
        validateKeywords = true,
        validateVisibility = true,
        validateUal = true,
    ) {
        if (
            validateFiles &&
            (!req.files ||
                !req.files.file ||
                path.extname(req.files.file.name).toLowerCase() !== '.json') &&
            !req.body.data
        ) {
            return {
                isValid: false,
                code: 400,
                message:
                    'No data provided. It is required to have assertion file or data in body, they must be in JSON-LD format.',
            };
        }

        if (validateFileSize && req.files.file.size > MAX_FILE_SIZE) {
            return {
                isValid: false,
                code: 400,
                message: `File size limit is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
            };
        }

        if (
            validateFileSize &&
            req.body &&
            req.body.data &&
            Buffer.byteLength(req.body.data, 'utf-8') > MAX_FILE_SIZE
        ) {
            return {
                isValid: false,
                code: 400,
                message: `File size limit is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
            };
        }

        if (
            validateKeywords &&
            req.body.keywords &&
            !Utilities.isArrayOfStrings(req.body.keywords)
        ) {
            return {
                isValid: false,
                code: 400,
                message:
                    'Keywords must be a non-empty array of strings, all strings must have double quotes.',
            };
        }

        if (
            validateVisibility &&
            req.body.visibility &&
            !PublishAllowedVisibilityParams.includes(req.body.visibility)
        ) {
            return {
                isValid: false,
                code: 400,
                message: 'Visibility must be a string, value can be public or private.',
            };
        }

        if (validateUal && req.body.ual) {
            return {
                isValid: false,
                code: 400,
                message: 'Ual parameter missing in request.',
            };
        }

        return {
            isValid: true,
        };
    }
}

module.exports = PublishController;
