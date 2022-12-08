import Command from '../../../command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

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
        const { id, operationId } = command.data;

        // id options :
        // did:otp:0x174714134abcd13431413413/987654321/41eaa20f35f709d9c22281f46d895b2f7a83c54587e4339456e0d9f4e5bd9b8f
        // did:otp:0x174714134abcd13431413413/987654321/latest

        const commandData = {};
        if (!this.ualService.isUAL(id)) {
            console.log(id);
            this.handleError(operationId, `Requested id is not a UAL`, this.errorType, true);
        } else {
            const {
                blockchain,
                contract,
                tokenId,
                assertionId: ualAssertionId,
            } = this.ualService.resolveUAL(id);
            commandData.blockchain = blockchain;
            commandData.tokenId = tokenId;
            commandData.contract = contract;

            if (ualAssertionId && ualAssertionId !== 'latest') {
                commandData.assertionId = ualAssertionId;
            } else {
                this.logger.debug(
                    `Searching for assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
                );
                const blockchainAssertionId =
                    await this.blockchainModuleManager.getLatestAssertionId(
                        blockchain,
                        contract,
                        tokenId,
                    );
                if (!blockchainAssertionId) {
                    this.handleError(
                        operationId,
                        `Unable to find assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
                        this.errorType,
                        true,
                    );
                    return Command.empty();
                }
                commandData.assertionId = blockchainAssertionId;
            }
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
