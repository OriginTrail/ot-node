/* eslint-disable import/extensions */
import Command from '../../../command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class GetLatestAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
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
        // 41eaa20f35f709d9c22281f46d895b2f7a83c54587e4339456e0d9f4e5bd9b8f

        let assertionId = '';
        if (!this.ualService.isUAL(id)) {
            assertionId = id;
        } else {
            const {
                blockchain,
                contract,
                tokenId,
                assertionId: ualAssertionId,
            } = this.ualService.resolveUAL(id);

            if (ualAssertionId && ualAssertionId !== 'latest') {
                assertionId = ualAssertionId;
            } else {
                this.logger.debug(
                    `Searching for assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
                );
                const blockchainAssertionId =
                    await this.blockchainModuleManager.getLatestCommitHash(
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
                assertionId = blockchainAssertionId;
            }
        }

        return this.continueSequence({ ...command.data, assertionId }, command.sequence);
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
