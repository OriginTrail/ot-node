const Command = require('../../../command');
const { ERROR_TYPE, OPERATION_ID_STATUS } = require('../../../../constants/constants');

class ValidateStoreInitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.networkModuleManager = ctx.networkModuleManager;

        this.publishService = ctx.publishService;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_VALIDATE_ASSERTION_REMOTE_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual, operationId } = command.data;
        this.logger.info(`Validating assertion with ual: ${ual}`);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_STAKE_START,
        );

        /* const operationIdData = await this.operationIdService.getCachedOperationIdData(operationId);

        const assertion = operationIdData.data.concat(operationIdData.metadata);
        // const blockchainData = this.blockchainModuleManager.getAssetProofs(ual);

        const calculatedRootHash = this.validationModuleManager.calculateRootHash(assertion);

        if (blockchainData.rootHash !== calculatedRootHash) {
            this.logger.debug(`Invalid root hash. Received value from blockchin: ${blockchainData.rootHash}, calculated: ${calculatedRootHash}`);
            await this.handleError(operationId, 'Invalid assertion metadata, root hash mismatch!', ERROR_TYPE.VALIDATE_ASSERTION_ERROR, true);
            return Command.empty();
        }
        this.logger.debug('Root hash matches');

        if (blockchainData.issuer !== issuer) {
            this.logger.debug(`Invalid issuer. Received value from blockchin: ${blockchainData.issuer}, from metadata: ${issuer}`);
            await this.handleError(operationId, 'Invalid assertion metadata, issuer mismatch!', ERROR_TYPE.VALIDATE_ASSERTION_ERROR, true);
            return Command.empty();
        }
        this.logger.debug('Issuer is valid');

        this.logger.info(`Assertion with id: ${calculatedRootHash} passed all checks!`);

        const commandData = command.data;
        commandData.assertionId = calculatedRootHash; */

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_STAKE_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default prepareAssertionForPublish
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'ValidateStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ValidateStoreInitCommand;
