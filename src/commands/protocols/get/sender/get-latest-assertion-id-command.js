import Command from '../../../command.js';
import { ERROR_TYPE, GET_STATES } from '../../../../constants/constants.js';

class GetLatestAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.GET.GET_ASSERTION_ID_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { id, operationId, state } = command.data;

        const commandData = {};
        if (!this.ualService.isUAL(id)) {
            this.handleError(operationId, `Requested id is not a UAL`, this.errorType, true);

            return Command.empty();
        }

        const { blockchain, contract, tokenId } = this.ualService.resolveUAL(id);
        commandData.blockchain = blockchain;
        commandData.tokenId = tokenId;
        commandData.contract = contract;

        let unfinalizedAssertionId;
        if (state === GET_STATES.LATEST) {
            this.logger.debug(
                `Searching for latest assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
            );
            unfinalizedAssertionId = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                blockchain,
                tokenId,
            );
            commandData.assertionId = unfinalizedAssertionId;
        }

        if (
            typeof unfinalizedAssertionId === 'undefined' ||
            !unfinalizedAssertionId ||
            parseInt(unfinalizedAssertionId, 16) === 0
        ) {
            this.logger.debug(
                `Searching for latest finalized assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
            );
            const blockchainAssertionId = await this.blockchainModuleManager.getLatestAssertionId(
                blockchain,
                contract,
                tokenId,
            );
            if (!blockchainAssertionId) {
                this.handleError(
                    operationId,
                    `Unable to find latest finalized assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
                    this.errorType,
                    true,
                );

                return Command.empty();
            }
            commandData.assertionId = blockchainAssertionId;
        }

        return this.continueSequence({ ...command.data, ...commandData }, command.sequence);
    }

    /**
     * Builds default getLatestAssertionIdCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getLatestAssertionIdCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetLatestAssertionIdCommand;
