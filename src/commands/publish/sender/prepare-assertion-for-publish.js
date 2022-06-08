const Command = require('../../command');
const Models = require('../../../../models');
const { ERROR_TYPE, PUBLISH_METHOD } = require('../../../constants/constants');

class PrepareAssertionForPublish extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.dataService = ctx.dataService;
        this.fileService = ctx.fileService;
        this.workerPool = ctx.workerPool;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.workerPool = ctx.workerPool;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            fileExtension,
            keywords,
            visibility,
            method,
            ual,
            handlerId,
            operationId,
            isTelemetry,
        } = command.data;

        let { documentPath } = command.data;
        const rawAssertion = await this.fileService.readFileOnPath(documentPath);
        let assertion;
        let nquads;
        try {
            const result = await this.dataService.canonize(rawAssertion, fileExtension);
            assertion = result.assertion;
            nquads = result.nquads;
        } catch (error) {
            this.handleError(handlerId, error, ERROR_TYPE.PREPARE_ASSERTION_ERROR, true);
            return Command.empty();
        }

        this.logger.emit({
            msg: 'Finished measuring execution of data canonization',
            Event_name: 'publish_canonization_end',
            Operation_name: 'publish_canonization',
            Id_operation: operationId,
        });
        this.logger.emit({
            msg: 'Started measuring execution of generate metadata',
            Event_name: 'publish_generate_metadata_start',
            Operation_name: 'publish_generate_metadata',
            Id_operation: operationId,
        });
        assertion.metadata.issuer = this.blockchainModuleManager.getPublicKey();
        assertion.metadata.visibility = visibility;
        assertion.metadata.keywords = keywords;
        assertion.metadata.keywords.sort();

        if (method === PUBLISH_METHOD.PROVISION) {
            const calculatedUal = this.validationModuleManager.calculateHash(
                assertion.metadata.timestamp + assertion.metadata.type + assertion.metadata.issuer,
            );
            assertion.metadata.UALs = [calculatedUal];
        } else if (method === PUBLISH_METHOD.UPDATE) {
            assertion.metadata.UALs = [ual];
        }

        assertion.metadata.dataHash = this.validationModuleManager.calculateHash(assertion.data);
        assertion.metadataHash = this.validationModuleManager.calculateHash(assertion.metadata);
        assertion.id = this.validationModuleManager.calculateHash(
            assertion.metadataHash + assertion.metadata.dataHash,
        );
        assertion.signature = this.validationModuleManager.sign(assertion.id, this.blockchainModuleManager.getPrivateKey());

        const processedNquads = await this.dataService.appendMetadata(nquads, assertion);

        assertion.rootHash = this.validationModuleManager.calculateRootHash(processedNquads);

        if (ual !== undefined) {
            this.logger.info(`UAL: ${ual}`);
        }
        this.logger.info(`Assertion ID: ${assertion.id}`);
        this.logger.info(`Assertion metadataHash: ${assertion.metadataHash}`);
        this.logger.info(`Assertion dataHash: ${assertion.metadata.dataHash}`);
        this.logger.info(`Assertion rootHash: ${assertion.rootHash}`);
        this.logger.info(`Assertion signature: ${assertion.signature}`);
        this.logger.info(`Assertion length in N-QUADS format: ${nquads.length}`);
        this.logger.info(`Keywords: ${keywords}`);
        this.logger.emit({
            msg: assertion.id,
            Event_name: 'publish_assertion_id',
            Operation_name: 'publish_assertion_id',
            Id_operation: operationId,
        });

        const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

        documentPath = await this.fileService.writeContentsToFile(
            handlerIdCachePath,
            handlerId,
            await this.workerPool.exec('JSONStringify', [
                {
                    nquads: processedNquads,
                    assertion,
                },
            ]),
        );

        // update handler id data with assertion
        const handlerData = {
            id: assertion.id,
            rootHash: assertion.rootHash,
            signature: assertion.signature,
            metadata: assertion.metadata,
        };

        await Models.handler_ids.update(
            {
                data: JSON.stringify(handlerData),
            },
            {
                where: {
                    handler_id: handlerId,
                },
            },
        );

        return this.continueSequence(
            {
                documentPath,
                handlerId,
                method,
                isTelemetry,
                operationId,
            },
            command.sequence,
        );
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { handlerId } = command.data;
        await this.handleError(handlerId, err, ERROR_TYPE.PREPARE_ASSERTION_ERROR, true);

        return Command.empty();
    }

    /**
     * Builds default prepareAssertionForPublish
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'prepareAssertionForPublish',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PrepareAssertionForPublish;
