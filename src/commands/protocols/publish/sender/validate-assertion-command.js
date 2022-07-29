const Command = require('../../../command');
const { ERROR_TYPE, OPERATION_ID_STATUS } = require('../../../../constants/constants');

class ValidateAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual, operationId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_START,
        );
        try {
            const assertionId = await this.operationService.validateAssertion(ual, operationId);
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_END,
            );

            const commandSequence = [
                // 'insertAssertionCommand',
                'networkPublishCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: { ...command.data, assertionId },
                transactional: false,
            });
        } catch (error) {
            this.logger.warn(
                `Unable to validate blockchain data for ual: ${ual}. Received error: ${error.message}, retrying.`,
            );
            return Command.retry();
        }
    }

    async retryFinished(command) {
        const { ual, operationId } = command.data;
        const message = `Retry count for command: ${command.name} reached! Unable to validate ual: ${ual}`;
        this.logger.trace(message);
        await this.handleError(operationId, message, this.errorType, true);
    }

    /**
     * Builds default prepareAssertionForPublish
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'validateAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ValidateAssertionCommand;
