const Command = require('../../../command');
const { ERROR_TYPE, OPERATION_ID_STATUS } = require('../../../../constants/constants');

class ValidateStoreInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.networkModuleManager = ctx.networkModuleManager;

        this.publishService = ctx.publishService;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_REMOTE_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual, operationId, keywordUuid, assertionId } = command.data;
        this.logger.info(`Validating assertion with ual: ${ual}`);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_START,
        );
        try {
            const calculatedAssertionId = await this.operationService.validateAssertion(
                ual,
                operationId,
            );
            if (calculatedAssertionId !== assertionId) {
                await this.handleError(
                    operationId,
                    'Assertion id miss match!',
                    ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_REMOTE_ERROR,
                    true,
                );
            } else {
                await this.operationIdService.updateOperationIdData(
                    JSON.stringify({
                        assertionId,
                    }),
                    operationId,
                );
            }
        } catch (error) {
            return Command.retry();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_END,
        );

        await this.commandExecutor.add({
            name: 'handleStoreInitCommand',
            sequence: [],
            delay: 0,
            data: command.data,
            transactional: false,
        });
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        const message = `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`;
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
            name: 'ValidateStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ValidateStoreInitCommand;
