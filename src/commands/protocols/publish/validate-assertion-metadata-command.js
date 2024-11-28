import Command from '../../command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../constants/constants.js';

class ValidateAssertionMetadataCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.VALIDATE_ASSERTION_METADATA_ERROR;
    }

    async execute(command) {
        const { operationId, ual, blockchain, merkleRoot, cachedMerkleRoot } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_METADATA_VALIDATION_START,
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
            }
        } catch (e) {
            await this.handleError(operationId, blockchain, e.message, this.errorType, true);
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            null,
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_METADATA_VALIDATION_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default validateAssertionMetadataCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'validateAssertionMetadataCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ValidateAssertionMetadataCommand;
