import Command from '../../../command.js';
import { ERROR_TYPE, GET_STATES } from '../../../../constants/constants.js';

class GetAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.GET.GET_ASSERTION_ID_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain, contract, tokenId, state } = command.data;

        let assertionId;
        if (!Object.values(GET_STATES).includes(state)) {
            assertionId = state;
        } else {
            this.logger.debug(
                `Searching for latest assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
            );

            if (state === GET_STATES.LATEST) {
                assertionId = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                    blockchain,
                    tokenId,
                );
            }
            if (assertionId == null || parseInt(assertionId, 16) === 0) {
                assertionId = await this.blockchainModuleManager.getLatestAssertionId(
                    blockchain,
                    contract,
                    tokenId,
                );
            }
        }

        return this.continueSequence(
            { ...command.data, state: assertionId, assertionId },
            command.sequence,
        );
    }

    async handleError(operationId, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(operationId, errorMessage, errorType);
    }

    /**
     * Builds default getStateIdConditionalCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getAssertionIdCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetAssertionIdCommand;
