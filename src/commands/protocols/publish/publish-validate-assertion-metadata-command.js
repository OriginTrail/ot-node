import ValidateAssertionMetadataCommand from '../common/validate-assertion-metadata-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../constants/constants.js';

class PublishValidateAssertionMetadataCommand extends ValidateAssertionMetadataCommand {
    constructor(ctx) {
        super(ctx);
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_METADATA_ERROR;
        this.operationStartEvent =
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_METADATA_VALIDATION_START;
        this.operationEndEvent =
            OPERATION_ID_STATUS.PUBLISH_FINALIZATION.PUBLISH_FINALIZATION_METADATA_VALIDATION_END;
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
