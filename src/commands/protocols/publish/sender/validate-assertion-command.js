import Command from '../../../command.js';
import { ERROR_TYPE, PUBLISH_TYPES, OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class ValidateAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { publishType, assertionId, operationId } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_START,
        );

        if (publishType === PUBLISH_TYPES.ASSET) {
            const { blockchain, contract, tokenId } = command.data;
            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            this.logger.info(`Validating assertion with ual: ${ual}`);

            const blockchainAssertionId = await this.operationService.getAssertion(
                blockchain,
                contract,
                tokenId,
            );
            if (!blockchainAssertionId) {
                return Command.retry();
            }
            if (blockchainAssertionId !== assertionId) {
                await this.handleError(
                    operationId,
                    `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${assertionId}`,
                    this.errorType,
                    true,
                );
                return Command.empty();
            }
        }

        await this.operationService.validateAssertion(assertionId, operationId);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_END,
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

export default ValidateAssertionCommand;
