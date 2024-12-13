import ValidateAssertionMetadataCommand from '../common/validate-assertion-metadata-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../constants/constants.js';
import Command from '../../command.js';

class PublishValidateAssertionMetadataCommand extends ValidateAssertionMetadataCommand {
    constructor(ctx) {
        super(ctx);
        this.operationIdService = ctx.operationIdService;
        this.dataService = ctx.dataService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_METADATA_ERROR;
        this.operationStartEvent =
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_METADATA_VALIDATION_START;
        this.operationEndEvent =
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_METADATA_VALIDATION_END;
    }

    async execute(command) {
        const {
            operationId,
            ual,
            blockchain,
            assertion,
            merkleRoot,
            cachedMerkleRoot,
            chunksAmount,
        } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.operationStartEvent,
        );

        try {
            if (merkleRoot !== cachedMerkleRoot) {
                await this.handleError(
                    operationId,
                    blockchain,
                    `Invalid Merkle Root for Knowledge Collection with UAL: ${ual}. Received value from blockchain: ${merkleRoot}, Cached value from publish operation: ${cachedMerkleRoot}`,
                    this.errorType,
                    true,
                );

                const calculatedChunksAmount = this.dataService.calculateChunksAmount(assertion);

                if (chunksAmount !== calculatedChunksAmount) {
                    await this.handleError(
                        operationId,
                        blockchain,
                        `Invalid Chunks Amount for Knowledge Collection with UAL: ${ual}. Received value from blockchain: ${chunksAmount}, Calculated value: ${calculatedChunksAmount}`,
                        this.errorType,
                        true,
                    );
                }
            }
        } catch (e) {
            await this.handleError(operationId, blockchain, e.message, this.errorType, true);
            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.operationEndEvent,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default publishValidateAssertionMetadataCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishValidateAssertionMetadataCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishValidateAssertionMetadataCommand;
