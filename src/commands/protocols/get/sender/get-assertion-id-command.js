import Command from '../../../command.js';
import { ERROR_TYPE, GET_STATES, ZERO_BYTES32 } from '../../../../constants/constants.js';

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
        const { operationId, blockchain, contract, tokenId, state } = command.data;

        let assertionId;
        if (!Object.values(GET_STATES).includes(state)) {
            if (state === ZERO_BYTES32) {
                await this.handleError(
                    operationId,
                    command,
                    this.errorType,
                    `State hash cannot be 0x0.`,
                    true,
                );

                return Command.empty();
            }

            const pendingState = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                blockchain,
                tokenId,
            );

            if (
                state !== pendingState &&
                !(
                    await this.blockchainModuleManager.getAssertionIds(
                        blockchain,
                        contract,
                        tokenId,
                    )
                ).includes(state)
            ) {
                await this.handleError(
                    operationId,
                    command,
                    this.errorType,
                    `Provided State: ${state} does not exist on the Blockchain: ${blockchain}, ` +
                        `within the Contract: ${contract}, for the Knowledge Asset with the token ID: ${tokenId}.`,
                    true,
                );

                return Command.empty();
            }

            assertionId = state;
        } else {
            this.logger.debug(
                `Searching for the latest Assertion ID on the Blockchain: ${blockchain}, ` +
                    `within the Contract: ${contract}, for the Knowledge Asset with the Token ID: ${tokenId}.`,
            );

            if (state === GET_STATES.LATEST) {
                assertionId = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                    blockchain,
                    tokenId,
                );
            }
            if (assertionId == null || assertionId === ZERO_BYTES32) {
                assertionId = await this.blockchainModuleManager.getLatestAssertionId(
                    blockchain,
                    contract,
                    tokenId,
                );
            }
        }

        return this.continueSequence({ ...command.data, state, assertionId }, command.sequence);
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
