import ValidateAssertionMetadataCommand from '../common/validate-assertion-metadata-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../constants/constants.js';

class UpdateValidateAssertionMetadataCommand extends ValidateAssertionMetadataCommand {
    constructor(ctx) {
        super(ctx);
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_VALIDATE_ASSERTION_METADATA_ERROR;
        this.operationStartEvent =
            OPERATION_ID_STATUS.UPDATE_FINALIZATION.UPDATE_FINALIZATION_METADATA_VALIDATION_START;
        this.operationEndEvent =
            OPERATION_ID_STATUS.UPDATE_FINALIZATION.UPDATE_FINALIZATION_METADATA_VALIDATION_END;
    }

    /**
     * Builds default updateValidateAssertionMetadataCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'updateValidateAssertionMetadataCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default UpdateValidateAssertionMetadataCommand;
