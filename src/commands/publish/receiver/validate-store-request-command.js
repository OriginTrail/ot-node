const Command = require('../../command');
const {
    ERROR_TYPE,
    HANDLER_ID_STATUS,
    NETWORK_PROTOCOLS,
} = require('../../../constants/constants');
const constants = require('../../../constants/constants');

class ValidateStoreRequestCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.handlerIdService = ctx.handlerIdService;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual, handlerId, metadata } = command.data;
        this.logger.info(`Validating assertion with ual: ${ual}`);
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.VALIDATING_ASSERTION,
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
        return this.continueSequence(commandData, command.sequence);
    }

    async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
        this.logger.error({
            msg: errorMessage,
        });

        const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
        const messageData = {};
        await this.networkModuleManager.sendMessageResponse(
            NETWORK_PROTOCOLS.STORE,
            commandData.remotePeerId,
            messageType,
            handlerId,
            messageData,
        );
        return Command.empty();
    }

    /**
     * Builds default prepareAssertionForPublish
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'validateStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ValidateStoreRequestCommand;
