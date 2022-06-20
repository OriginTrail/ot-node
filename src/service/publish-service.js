const {PUBLISH_REQUEST_STATUS} = require("../constants/constants");
const constants = require("../constants/constants");

class PublishService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.commandExecutor = ctx.commandExecutor;
    }

    async processPublishResponse(command, status, errorMessage = null) {
        if (errorMessage) {
            await this.repositoryModuleManager.createPublishRequestRecord(
                PUBLISH_REQUEST_STATUS.FAILED,
                command.data.publishId,
                errorMessage
            );
        } else {
            await this.repositoryModuleManager.createPublishRequestRecord(
                PUBLISH_REQUEST_STATUS.COMPLETED,
                command.data.publishId,
            );

        }

        const numberOfResponses = await this.repositoryModuleManager.getNumberOfPublishResponses(command.data.publishId);

        if (command.data.numberOfFoundNodes === numberOfResponses) {

            await this.commandExecutor.add(
                {
                    name: 'publishFinaliseCommand',
                    sequence: [],
                    data: {  },
                    transactional: false,
                },
                constants.REMOVE_SESSION_COMMAND_DELAY,
            );
        }
    }
    //
    // async publish(
    //     fileContent,
    //     fileExtension,
    //     keywords,
    //     visibility,
    //     ual,
    //     handlerId,
    //     operationId,
    //     isTelemetry = false,
    // ) {
    //     try {
    //         this.logger.emit({
    //             msg: 'Started measuring execution of data canonization',
    //             Event_name: 'publish_canonization_start',
    //             Operation_name: 'publish_canonization',
    //             Id_operation: operationId,
    //         });
    //         let {
    //             assertion,
    //             nquads,
    //         } = await this.dataService.canonize(fileContent, fileExtension);
    //         this.logger.emit({
    //             msg: 'Finished measuring execution of data canonization',
    //             Event_name: 'publish_canonization_end',
    //             Operation_name: 'publish_canonization',
    //             Id_operation: operationId,
    //         });
    //         this.logger.emit({
    //             msg: 'Started measuring execution of generate metadata',
    //             Event_name: 'publish_generate_metadata_start',
    //             Operation_name: 'publish_generate_metadata',
    //             Id_operation: operationId,
    //         });
    //         assertion.metadata.issuer = this.blockchainModuleManager.getPublicKey();
    //         assertion.metadata.visibility = visibility;
    //         assertion.metadata.keywords = keywords;
    //         assertion.metadata.keywords.sort();
    //         let method = constants.PUBLISH_METHOD.PUBLISH;
    //         if (ual === null) {
    //             method = constants.PUBLISH_METHOD.PROVISION;
    //             ual = this.validationModuleManager.calculateHash(
    //                 assertion.metadata.timestamp
    //                 + assertion.metadata.type
    //                 + assertion.metadata.issuer,
    //             );
    //             assertion.metadata.UALs = [ual];
    //         } else if (ual !== undefined) {
    //             method = constants.PUBLISH_METHOD.UPDATE;
    //             assertion.metadata.UALs = [ual];
    //         }
    //
    //         assertion.metadata.dataHash = this.validationModuleManager.calculateHash(assertion.data);
    //         assertion.metadataHash = this.validationModuleManager.calculateHash(assertion.metadata);
    //         assertion.id = this.validationModuleManager.calculateHash(
    //             assertion.metadataHash + assertion.metadata.dataHash,
    //         );
    //         assertion.signature = this.validationModuleManager.sign(assertion.id, this.blockchainModuleManager.getPrivateKey());
    //
    //         nquads = await this.dataService.appendMetadata(nquads, assertion);
    //         assertion.rootHash = this.validationModuleManager.calculateRootHash(nquads);
    //
    //         if (ual !== undefined) {
    //             this.logger.info(`UAL: ${ual}`);
    //         }
    //         this.logger.info(`Assertion ID: ${assertion.id}`);
    //         this.logger.info(`Assertion metadataHash: ${assertion.metadataHash}`);
    //         this.logger.info(`Assertion dataHash: ${assertion.metadata.dataHash}`);
    //         this.logger.info(`Assertion rootHash: ${assertion.rootHash}`);
    //         this.logger.info(`Assertion signature: ${assertion.signature}`);
    //         this.logger.info(`Assertion length in N-QUADS format: ${nquads.length}`);
    //         this.logger.info(`Keywords: ${keywords}`);
    //         this.logger.emit({
    //             msg: assertion.id,
    //             Event_name: 'publish_assertion_id',
    //             Operation_name: 'publish_assertion_id',
    //             Id_operation: operationId,
    //         });
    //
    //         const handlerIdCachePath = this.fileService.getHandlerIdCachePath();
    //
    //         const documentPath = await this.fileService
    //             .writeContentsToFile(handlerIdCachePath, handlerId,
    //                 await this.workerPool.exec('JSONStringify', [{
    //                     nquads, assertion,
    //                 }]));
    //
    //         const commandSequence = [
    //             'submitProofsCommand',
    //             'insertAssertionCommand',
    //             'sendAssertionCommand',
    //         ];
    //
    //         await this.commandExecutor.add({
    //             name: commandSequence[0],
    //             sequence: commandSequence.slice(1),
    //             delay: 0,
    //             data: {
    //                 documentPath, handlerId, method, isTelemetry, operationId,
    //             },
    //             transactional: false,
    //         });
    //         this.logger.emit({
    //             msg: 'Finished measuring execution of generate metadata',
    //             Event_name: 'publish_generate_metadata_end',
    //             Operation_name: 'publish_generate_metadata',
    //             Id_operation: operationId,
    //         });
    //         return assertion;
    //     } catch (e) {
    //         return null;
    //     }
    // }
    //
    // async store(assertion, node) {
    //     // await this.networkModuleManager.store(node, topic, {});
    //     let retries = 0;
    //     let response = await this.networkModuleManager.sendMessage(
    //         constants.NETWORK_PROTOCOLS.STORE,
    //         assertion,
    //         node,
    //     );
    //     while (
    //         response === constants.NETWORK_RESPONSES.BUSY
    //         && retries < constants.STORE_MAX_RETRIES
    //     ) {
    //         retries += 1;
    //         await setTimeout(constants.STORE_BUSY_REPEAT_INTERVAL_IN_MILLS);
    //         response = await this.networkModuleManager.sendMessage(
    //             constants.NETWORK_PROTOCOLS.STORE,
    //             assertion,
    //             node,
    //         );
    //     }
    //
    //     return response;
    // }
    //
    // async handleStore(data) {
    //     if (!data || data.rdf) return false;
    //     if (this.dataService.isNodeBusy(constants.BUSYNESS_LIMITS.HANDLE_STORE)) {
    //         return constants.NETWORK_RESPONSES.BUSY;
    //     }
    //
    //     const operationId = uuidv1();
    //     this.logger.emit({
    //         msg: 'Started measuring execution of handle store command',
    //         Event_name: 'handle_store_start',
    //         Operation_name: 'handle_store',
    //         Id_operation: operationId,
    //     });
    //
    //     try {
    //         const { jsonld, nquads } = await this.dataService.createAssertion(data.nquads);
    //         const status = await this.dataService.verifyAssertion(jsonld, nquads);
    //
    //         // todo check root hash on the blockchain
    //         if (status) {
    //             await this.dataService.insert(data.nquads.join('\n'), `${constants.DID_PREFIX}:${data.id}`);
    //             this.logger.info(`Assertion ${data.id} has been successfully inserted`);
    //         }
    //
    //         this.logger.emit({
    //             msg: 'Finished measuring execution of handle store command',
    //             Event_name: 'handle_store_end',
    //             Operation_name: 'handle_store',
    //             Id_operation: operationId,
    //         });
    //
    //         return status;
    //     } catch (e) {
    //         this.logger.emit({
    //             msg: 'Finished measuring execution of handle store command',
    //             Event_name: 'handle_store_end',
    //             Operation_name: 'handle_store',
    //             Id_operation: operationId,
    //         });
    //         this.logger.error({
    //             msg: `Error while handling store: ${e} - ${e.stack}`,
    //             Operation_name: 'Error',
    //             Event_name: constants.ERROR_TYPE.HANDLE_STORE_ERROR,
    //             Id_operation: operationId,
    //         });
    //         return false;
    //     }
    // }
}

module.exports = PublishService;
