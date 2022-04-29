const { v1: uuidv1 } = require('uuid');
const sleep = require('sleep-async')().Promise;
const constants = require('../constants');

class PublishService {
    constructor(ctx) {
        this.networkService = ctx.networkService;
        this.validationService = ctx.validationService;
        this.blockchainService = ctx.blockchainService;
        this.dataService = ctx.dataService;
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.fileService = ctx.fileService;
        this.workerPool = ctx.workerPool;
    }

    async publish(
        fileContent,
        fileExtension,
        keywords,
        visibility,
        method,
        handlerId,
        operationId,
        isTelemetry = false,
    ) {
        try {
            this.logger.emit({
                msg: 'Started measuring execution of data canonization',
                Event_name: 'publish_canonization_start',
                Operation_name: 'publish_canonization',
                Id_operation: operationId,
            });
            let {
                assertion,
                nquads,
            } = await this.dataService.canonize(fileContent, fileExtension, method);
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
            assertion.metadata.issuer = this.validationService.getIssuer();
            assertion.metadata.visibility = visibility;


            assertion.metadata.dataHash = this.validationService.calculateHash(assertion.data);
            assertion.metadataHash = this.validationService.calculateHash(assertion.metadata);
            assertion.id = this.validationService.calculateHash(
                assertion.metadataHash + assertion.metadata.dataHash,
            );
            assertion.signature = this.validationService.sign(assertion.id);

            if (assertion.data['@id']) {
                this.logger.info(`UAL: ${assertion.data['@id']}`);
                keywords.push(assertion.data['@id']);
            }
            assertion.metadata.keywords = keywords;
            assertion.metadata.keywords.sort();

            nquads = await this.dataService.appendMetadata(nquads, assertion);
            assertion.rootHash = this.validationService.calculateRootHash(nquads);

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

            const documentPath = await this.fileService
                .writeContentsToFile(handlerIdCachePath, handlerId,
                    await this.workerPool.exec('JSONStringify', [{
                        nquads, assertion,
                    }]));

            const commandSequence = [
                'submitProofsCommand',
                'insertAssertionCommand',
                'sendAssertionCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    documentPath, handlerId, method, isTelemetry, operationId,
                },
                transactional: false,
            });
            this.logger.emit({
                msg: 'Finished measuring execution of generate metadata',
                Event_name: 'publish_generate_metadata_end',
                Operation_name: 'publish_generate_metadata',
                Id_operation: operationId,
            });
            return assertion;
        } catch (e) {
            return null;
        }
    }

    async store(assertion, node) {
        // await this.networkService.store(node, topic, {});
        let retries = 0;
        let response = await this.networkService.sendMessage(
            constants.NETWORK_PROTOCOLS.STORE,
            assertion,
            node,
        );
        while (
            response === constants.NETWORK_RESPONSES.BUSY
            && retries < constants.STORE_MAX_RETRIES
        ) {
            retries += 1;
            await sleep.sleep(constants.STORE_BUSY_REPEAT_INTERVAL_IN_MILLS);
            response = await this.networkService.sendMessage(
                constants.NETWORK_PROTOCOLS.STORE,
                assertion,
                node,
            );
        }

        return response;
    }

    async handleStore(data) {
        if (!data) return false;
        if (this.dataService.isNodeBusy(constants.BUSYNESS_LIMITS.HANDLE_STORE)) {
            return constants.NETWORK_RESPONSES.BUSY;
        }

        const operationId = uuidv1();
        this.logger.emit({
            msg: 'Started measuring execution of handle store command',
            Event_name: 'handle_store_start',
            Operation_name: 'handle_store',
            Id_operation: operationId,
        });

        try {
            const { jsonld, nquads } = await this.dataService.createAssertion(data.nquads);
            // const status = await this.dataService.verifyAssertion(jsonld, nquads);
            const status = true;
            // todo check root hash on the blockchain
            if (status) {
                await this.dataService.insert(data.nquads.join('\n'), `${constants.DID_PREFIX}:${data.id}`);
                this.logger.info(`Assertion ${data.id} has been successfully inserted`);
            } else {
                this.logger.info(`Assertion ${data.id} has not been inserted, failed at verification.`);
            }

            this.logger.emit({
                msg: 'Finished measuring execution of handle store command',
                Event_name: 'handle_store_end',
                Operation_name: 'handle_store',
                Id_operation: operationId,
            });

            return status;
        } catch (e) {
            this.logger.emit({
                msg: 'Finished measuring execution of handle store command',
                Event_name: 'handle_store_end',
                Operation_name: 'handle_store',
                Id_operation: operationId,
            });
            this.logger.error({
                msg: `Error while handling store: ${e} - ${e.stack}`,
                Operation_name: 'Error',
                Event_name: constants.ERROR_TYPE.HANDLE_STORE_ERROR,
                Id_operation: operationId,
            });
            return false;
        }
    }
}

module.exports = PublishService;
