import { setTimeout } from 'timers/promises';
import Command from '../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    MAX_RETRIES_READ_CACHED_PUBLISH_DATA,
    RETRY_DELAY_READ_CACHED_PUBLISH_DATA,
} from '../../../constants/constants.js';

class ReadCachedPublishDataCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.fileService = ctx.fileService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;

        this.errorType = ERROR_TYPE.STORE_ASSERTION_ERROR;
    }

    async execute(command) {
        const { event } = command.data;
        const eventData = JSON.parse(event.data);
        const { id, publishOperationId, merkleRoot, chunksAmount } = eventData;
        const { blockchain, contractAddress } = event;
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_START,
            publishOperationId,
        );
        let datasetPath;
        let cachedData;

        for (let attempt = 1; attempt <= MAX_RETRIES_READ_CACHED_PUBLISH_DATA; attempt += 1) {
            try {
                if (attempt <= 2) throw Error();
                datasetPath = this.fileService.getPendingStorageDocumentPath(publishOperationId);

                // eslint-disable-next-line no-await-in-loop
                cachedData = await this.fileService.readFile(datasetPath, true);

                break;
            } catch (error) {
                if (attempt === MAX_RETRIES_READ_CACHED_PUBLISH_DATA) {
                    this.operationIdService.updateOperationIdStatus(
                        operationId,
                        blockchain,
                        OPERATION_ID_STATUS.FAILED,
                        error.message,
                        ERROR_TYPE.FINALITY.FINALITY_ERROR,
                    );
                } else {
                    // eslint-disable-next-line no-await-in-loop
                    await setTimeout(RETRY_DELAY_READ_CACHED_PUBLISH_DATA);
                }
            }
        }
        const ual = this.ualService.deriveUAL(blockchain, contractAddress, id);

        const myPeerId = this.networkModuleManager.getPeerId().toB58String();
        if (cachedData.remotePeerId === myPeerId) {
            await this.repositoryModuleManager.saveFinalityAck(
                publishOperationId,
                ual,
                cachedData.remotePeerId,
            );
        } else {
            command.sequence.push('findPublisherNodeCommand', 'networkFinalityCommand');
        }

        return this.continueSequence(
            {
                operationId,
                ual,
                blockchain,
                contract: contractAddress,
                tokenId: id,
                merkleRoot,
                chunksAmount,
                remotePeerId: cachedData.remotePeerId,
                publishOperationId,
                assertion: cachedData.assertion,
                cachedMerkleRoot: cachedData.merkleRoot,
            },
            command.sequence,
        );
    }

    /**
     * Builds default readCachedPublishDataCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'readCachedPublishDataCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ReadCachedPublishDataCommand;
