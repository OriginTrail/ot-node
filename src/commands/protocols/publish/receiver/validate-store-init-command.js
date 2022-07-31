const Command = require('../../../command');
const { ERROR_TYPE, OPERATION_ID_STATUS } = require('../../../../constants/constants');

class ValidateStoreInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_REMOTE_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, ual } = command.data;

        this.logger.info(`Validating assertion with ual: ${ual}`);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_START,
        );

        let assertionId;
        try {
            assertionId = await this.operationService.getAssertion(ual, operationId);
        } catch (error) {
            return Command.retry();
        }

        await Promise.all([
            this.operationIdService.cacheOperationIdData(operationId, { assertionId }),
            this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_END,
            ),
        ]);

        return this.continueSequence(command.data, command.sequence);
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        await this.handleError(
            operationId,
            `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`,
            this.errorType,
            true,
        );

        // TODO send NACK
    }

    /**
     * Builds default ValidateStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'ValidateStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ValidateStoreInitCommand;
