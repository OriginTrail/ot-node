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

        const commandData = {};

        let assertionId;
        if (state === GET_STATES.LATEST) {
            this.logger.debug(
                `Searching for latest assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
            );

            assertionId = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                blockchain,
                tokenId,
            );

            commandData.assertionId = assertionId;
            commandData.state = assertionId;
        }

        if (
            state === GET_STATES.FINALIZED &&
            (typeof assertionId === 'undefined' || !assertionId || parseInt(assertionId, 16) === 0)
        ) {
            this.logger.debug(
                `Searching for latest finalized assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
            );

            assertionId = await this.blockchainModuleManager.getLatestAssertionId(
                blockchain,
                contract,
                tokenId,
            );

            commandData.assertionId = assertionId;
            commandData.state = assertionId;
        }

        if (!Object.values(GET_STATES).includes(state)) {
            commandData.assertionId = state;
        }

        return this.continueSequence({ ...command.data, ...commandData }, command.sequence);
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
