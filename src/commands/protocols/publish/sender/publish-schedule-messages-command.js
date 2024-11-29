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
        // const {
        // operationId,
        // keyword,
        // leftoverNodes,
        // numberOfFoundNodes,
        // blockchain,
        // minAckResponses,
        // hashFunctionId,
        // assertionId,
        // tokenId,
        // contract,
        // } = command.data;
        const isValid = true;
        // perform check only first time not for every batch
        // if (leftoverNodes.length === numberOfFoundNodes) {
        //     isValid = await this.validateBidsForNeighbourhood(
        //         blockchain,
        //         contract,
        //         tokenId,
        //         keyword,
        //         hashFunctionId,
        //         assertionId,
        //         leftoverNodes,
        //         minAckResponses,
        //         operationId,
        //     );
        // }
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
        const blockchainAssertionSize = await this.blockchainModuleManager.getAssertionSize(
            blockchain,
            assertionId,
        );

        const agreementId = this.serviceAgreementService.generateId(
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

        if (!agreementData) {
            await this.operationService.markOperationAsFailed(
                operationId,
                blockchain,
                'Unable to fetch agreement data.',
                ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR,
            );
            return false;
        }

        const r0 = await this.blockchainModuleManager.getR0();

        const serviceAgreementBid = await this.serviceAgreementService.calculateBid(
            blockchain,
            blockchainAssertionSize,
            agreementData,
            r0,
        );

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

    async getAsk(blockchain, nodeId) {
        const peerRecord = await this.repositoryModuleManager.getPeerRecord(nodeId, blockchain);

        return this.blockchainModuleManager.convertToWei(blockchain, peerRecord.ask);
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
