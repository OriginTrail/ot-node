import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    AGREEMENT_STATUS,
    TRIPLE_STORE_REPOSITORIES,
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

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const {
            blockchain,
            keyword,
            hashFunctionId,
            contract,
            tokenId,
            operationId,
            assertionId,
            agreementId,
            agreementData,
        } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.VALIDATING_UPDATE_ASSERTION_REMOTE_START,
        );

        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        // save data in pending storage - it's already stored under operation id, create new cache with ual as filename
        // schedule commit command

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
