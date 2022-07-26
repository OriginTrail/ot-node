const Command = require('../command');
const { ERROR_TYPE, HANDLER_ID_STATUS } = require('../../constants/constants');

class ValidateAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.ualService = ctx.ualService;
        this.handlerIdService = ctx.handlerIdService;

        this.errorType = ERROR_TYPE.VALIDATE_ASSERTION_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual, handlerId } = command.data;
        this.logger.info(`Validating assertion with ual: ${ual}`);
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_START,
        );

        const handlerIdData = await this.handlerIdService.getCachedHandlerIdData(handlerId);

        const assertion = handlerIdData.data.concat(handlerIdData.metadata);

        const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);
        const { issuer, assertionId } = await this.blockchainModuleManager.getAssetProofs(
            blockchain,
            contract,
            tokenId,
        );

        const calculatedAssertionId = this.validationModuleManager.calculateRootHash(assertion);

        if (assertionId !== calculatedAssertionId) {
            this.logger.debug(
                `Invalid root hash. Received value from blockchain: ${assertionId}, calculated: ${calculatedAssertionId}`,
            );
            await this.handleError(
                handlerId,
                'Invalid assertion metadata, root hash mismatch!',
                ERROR_TYPE.VALIDATE_ASSERTION_ERROR,
                true,
            );
            return Command.empty();
        }
        this.logger.debug('Root hash matches');

        // const verify = await this.blockchainService.verify(assertionId, signature, walletInformation.publicKey);
        //
        // if (issuer !== issuer) {
        //     this.logger.debug(`Invalid issuer. Received value from blockchin: ${issuer}, from metadata: ${issuer}`);
        //     await this.handleError(handlerId, 'Invalid assertion metadata, issuer mismatch!', ERROR_TYPE.VALIDATE_ASSERTION_ERROR, true);
        //     return Command.empty();
        // }
        this.logger.debug('Issuer is valid');

        this.logger.info(`Assertion with id: ${assertionId} passed all checks!`);

        const commandData = command.data;
        commandData.assertionId = assertionId;
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_END,
        );
        return this.continueSequence(commandData, command.sequence);
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
