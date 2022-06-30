const Command = require('../../command');
const { ERROR_TYPE } = require('../../../constants/constants');

class GetLatestAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.GET_ASSERTION_COMMAND;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { id, handlerId } = command.data;

        // options:
        // did:otp:0x174714134abcd13431413413/987654321/41eaa20f35f709d9c22281f46d895b2f7a83c54587e4339456e0d9f4e5bd9b8f
        // did:otp:0x174714134abcd13431413413/987654321/latest
        // 41eaa20f35f709d9c22281f46d895b2f7a83c54587e4339456e0d9f4e5bd9b8f
        const commandData = command.data;
        if (this.ualService.isUAL(id)) {
            const {
                blockchain,
                contract,
                tokenId,
                assertionId: ualAssertionId,
            } = this.ualService.resolveUAL(id);

            if (ualAssertionId && ualAssertionId !== 'latest') {
                commandData.assertionId = ualAssertionId;
                commandData.ual = id;
            } else {
                this.logger.debug(
                    `Searching for assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
                );
                const { assertionId: blockchainAssertionId } =
                    await this.blockchainModuleManager.getAssetProofs(
                        blockchain,
                        contract,
                        tokenId,
                    );
                if (!blockchainAssertionId) {
                    this.handleError(
                        handlerId,
                        `Unable to find assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}`,
                        this.errorType,
                        true,
                    );
                    return Command.empty();
                }
                commandData.assertionId = blockchainAssertionId;
                commandData.ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            }
        } else {
            commandData.assertionId = id;
        }
        this.logger.debug(`Resolving data with assertion id: ${commandData.assertionId}`);

        commandData.assertionId = id;

        return this.continueSequence(commandData, command.sequence);
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

module.exports = GetLatestAssertionIdCommand;
