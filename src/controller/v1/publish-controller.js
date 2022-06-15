const path = require('path');
const { MAX_FILE_SIZE, PUBLISH_METHOD } = require('../../../modules/constants');
const Utilities = require('../../../modules/utilities');
const BaseController = require('./base-controller');

const PublishAllowedVisibilityParams = ['public', 'private'];

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.workerPool = ctx.workerPool;
        this.publishService = ctx.publishService;
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.commandExecutor = ctx.commandExecutor;
        this.dataService = ctx.dataService;
        this.handlerIdService = ctx.handlerIdService;
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

        const handlerObject = await this.handlerIdService.generateHandlerId();

        const handlerId = handlerObject.handler_id;

        this.returnResponse(res, 202, {
            handlerId,
        });

        const {metadata, data, ual} = req.body;

        await this.handlerIdService.cacheHandlerIdData(handlerId, JSON.stringify({data, metadata}));

        const metadataObject = await this.dataService.extractMetadata(metadata);

        const validityMessage = this.validateMetadata(metadataObject);

        if (!validityMessage) {
            this.logger.error(validityMessage);
            await this.handlerIdService.updateFailedHandlerId(handlerId, validityMessage);
            return;
        };

        const {keywords, dataRootId, issuer, visibility, type} = metadataObject;

        const commandData = {
            method,
            ual,
            handlerId,
            operationId,
            keywords,
            dataRootId,
            issuer,
            visibility,
            type,
        };

        const commandSequence = [
            'validateAssertionCommand',
            'insertAssertionCommand',
            'findNodesCommand',
            'storeInitCommand',
            'storeRequestCommand',
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }

    validateMetadata(metadata) {
        if (!metadata.keywords || metadata.keywords.length === 0) {
            return 'Keywords are missing in assertion metadata';
        }
        if (!metadata.dataRootId) {
            return 'Data root id is missing in assertion metadata';
        }
        if (!metadata.issuer) {
            return 'Issuer is missing in assertion metadata';
        }
        if (!metadata.visibility) {
            return 'Visibility is missing in assertion metadata';
        }
        if (!metadata.type) {
            return 'Type is missing in assertion metadata';
        }
        return null;
    }

    async handleNetworkStoreRequest(message, remotePeerId) {
        const operationId = await this.generateHandlerId();
        let commandName;
        const commandData = { message, remotePeerId, operationId };
        switch (message.header.messageType) {
            case 'PROTOCOL_INIT':
                commandName = 'handleStoreInitCommand';
                break;
            case 'PROTOCOL_REQUEST':
                commandName = 'handleStoreRequestCommand';
                break;
            default:
                throw Error('unknown messageType');
        }

        await this.commandExecutor.add({
            name: commandName,
            sequence: [],
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }
}

module.exports = PublishController;
