import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
} from '../../../../../constants/constants.js';

class HandleUpdateRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;
        this.pendingStorageService = ctx.pendingStorageService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { blockchain, contract, tokenId, operationId, agreementId, agreementData } =
            commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_REMOTE_START,
        );

        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        await this.pendingStorageService.cacheAssertion(
            blockchain,
            contract,
            tokenId,
            { assertion },
            operationId,
        );

        await Promise.all([
            this.commandExecutor.add({
                name: 'deletePendingStateCommand',
                sequence: [],
                delay: 15 * 1000, // todo: get pending state time limit for validation
                data: commandData,
                transactional: false,
            }),
            this.commandExecutor.add({
                name: 'submitUpdateCommitCommand',
                delay: 0,
                period: 12 * 1000, // todo: get from blockchain / oracle
                retries: COMMAND_RETRIES.SUBMIT_UPDATE_COMMIT,
                data: { ...commandData, agreementData, agreementId },
                transactional: false,
            }),
        ]);

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default HandleUpdateRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleUpdateRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleUpdateRequestCommand;
