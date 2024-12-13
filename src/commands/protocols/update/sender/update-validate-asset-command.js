import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class UpdateValidateAssetCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.errorType = ERROR_TYPE.UPDATE.UPDATE_VALIDATE_ASSET_ERROR;
    }

    async handleError(operationId, blockchain, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(
            operationId,
            blockchain,
            errorMessage,
            errorType,
        );
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, assertionMerkleRoot } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_VALIDATE_ASSET_START,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_GET_CACHED_OPERATION_ID_DATA_START,
            operationId,
            blockchain,
        );
        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_GET_CACHED_OPERATION_ID_DATA_END,
            operationId,
            blockchain,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_VALIDATE_ASSERTION_ROOT_START,
            operationId,
            blockchain,
        );
        this.validationService.validateAssertionMerkleRoot(
            cachedData.assertion,
            assertionMerkleRoot,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_VALIDATE_ASSERTION_ROOT_END,
            operationId,
            blockchain,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_VALIDATE_ASSET_END,
        );
        return this.continueSequence(
            { ...command.data, retry: undefined, period: undefined },
            command.sequence,
        );
    }

    /**
     * Builds default updateValidateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'updateValidateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateValidateAssetCommand;
