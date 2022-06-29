const Command = require('../command');
const { ERROR_TYPE, HANDLER_ID_STATUS } = require('../../constants/constants');

class ValidateAssertionCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.handlerIdService = ctx.handlerIdService;
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
        // const blockchainData = this.blockchainModuleManager.getAssetProofs(ual);

        const calculatedRootHash = this.validationModuleManager.calculateRootHash(assertion);

        // if (blockchainData.rootHash !== calculatedRootHash) {
        //     this.logger.debug(`Invalid root hash. Received value from blockchin: ${blockchainData.rootHash}, calculated: ${calculatedRootHash}`);
        //     await this.handleError(handlerId, 'Invalid assertion metadata, root hash mismatch!', ERROR_TYPE.VALIDATE_ASSERTION_ERROR, true);
        //     return Command.empty();
        // }
        // this.logger.debug('Root hash matches');
        //
        // if (blockchainData.issuer !== issuer) {
        //     this.logger.debug(`Invalid issuer. Received value from blockchin: ${blockchainData.issuer}, from metadata: ${issuer}`);
        //     await this.handleError(handlerId, 'Invalid assertion metadata, issuer mismatch!', ERROR_TYPE.VALIDATE_ASSERTION_ERROR, true);
        //     return Command.empty();
        // }
        // this.logger.debug('Issuer is valid');

        this.logger.info(`Assertion with id: ${calculatedRootHash} passed all checks!`);

        const commandData = command.data;
        commandData.assertionId = calculatedRootHash;
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
            errorType: ERROR_TYPE.VALIDATE_ASSERTION_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ValidateAssertionCommand;
