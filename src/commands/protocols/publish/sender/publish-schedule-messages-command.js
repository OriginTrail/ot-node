import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import Command from '../../../command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class PublishScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.startEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
    }

    async execute(command) {
        const {
            operationId,
            keyword,
            leftoverNodes,
            numberOfFoundNodes,
            blockchain,
            minAckResponses,
            hashFunctionId,
            assertionId,
            tokenId,
            contract,
        } = command.data;
        let isValid = true;
        // perform check only first time not for every batch
        if (leftoverNodes.length === numberOfFoundNodes) {
            isValid = await this.validateBidsForNeighbourhood(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                assertionId,
                leftoverNodes,
                minAckResponses,
                operationId,
            );
        }
        if (isValid) {
            return super.execute(command);
        }
        return Command.empty();
    }

    async validateBidsForNeighbourhood(
        blockchain,
        contract,
        tokenId,
        keyword,
        hashFunctionId,
        assertionId,
        nodes,
        minAckResponses,
        operationId,
    ) {
        const agreementId = await this.serviceAgreementService.generateId(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        );

        const agreementData = await this.blockchainModuleManager.getAgreementData(
            blockchain,
            agreementId,
        );

        const r0 = await this.blockchainModuleManager.getR0(blockchain);

        const blockchainAssertionSize = await this.blockchainModuleManager.getAssertionSize(
            blockchain,
            assertionId,
        );

        const divisor = this.blockchainModuleManager
            .toBigNumber(blockchain, r0)
            .mul(Number(agreementData.epochsNumber))
            .mul(blockchainAssertionSize);

        const serviceAgreementBid = this.blockchainModuleManager
            .toBigNumber(blockchain, agreementData.tokenAmount)
            .add(agreementData.updateTokenAmount)
            .mul(1024)
            .div(divisor)
            .add(1); // add 1 wei because of the precision loss

        let validBids = 0;

        await Promise.all(
            nodes.map(async (node) => {
                const ask = await this.getAsk(blockchain, node.id);
                if (ask.lte(serviceAgreementBid)) {
                    validBids += 1;
                }
            }),
        );

        if (validBids < minAckResponses) {
            await this.operationService.markOperationAsFailed(
                operationId,
                blockchain,
                'Unable to start publish, not enough nodes in neighbourhood satisfy the bid.',
                ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR,
            );
            return false;
        }
        return true;
    }

    async getAsk(blockchain, id) {
        const peerRecord = await this.repositoryModuleManager.getPeerRecord(nodeId, blockchain);
        const ask = this.blockchainModuleManager.convertToWei(blockchain, peerRecord.ask);

        return this.blockchainModuleManager.toBigNumber(blockchain, ask);
    }

    /**
     * Builds default publishScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishScheduleMessagesCommand;
