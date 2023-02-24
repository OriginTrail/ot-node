import Command from '../../../command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class ValidateUpdateAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationService = ctx.publishService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_VALIDATE_ASSERTION_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { assertionId, operationId, blockchain, contract, tokenId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_START,
        );

        // implement validation

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_START,
        );
        return this.continueSequence(
            { ...command.data, retry: undefined, period: undefined },
            command.sequence,
        );
    }

    async retryFinished(command) {
        const { ual, operationId } = command.data;
        await this.handleError(
            operationId,
            `Max retry count for command: ${command.name} reached! Unable to validate ual: ${ual}`,
            this.errorType,
            true,
        );
    }

    /**
     * Builds default validateUpdateAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'validateUpdateAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ValidateUpdateAssertionCommand;
