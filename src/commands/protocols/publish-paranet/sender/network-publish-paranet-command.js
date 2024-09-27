import Command from '../../../command.js';
import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class NetworkPublishParanetCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishParanetService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH_PARANET.PUBLISH_PARANET_START_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain, contract, tokenId, hashFunctionId, paranetId } = command.data;

        const keywords = await this.getKeywords(command);
        const batchSize = await this.getBatchSize(blockchain);
        const minAckResponses = await this.getMinAckResponses(blockchain);

        const serviceAgreementId = this.serviceAgreementService.generateId(
            blockchain,
            contract,
            tokenId,
            keywords[0],
            hashFunctionId,
        );
        const proximityScoreFunctionsPairId =
            await this.blockchainModuleManager.getAgreementScoreFunctionId(
                blockchain,
                serviceAgreementId,
            );

        const commandSequence = [
            'findCuratedParanetNodesCommand',
            `${this.operationService.getOperationName()}ScheduleMessagesCommand`,
        ];

        const addCommandPromises = keywords.map((keyword) =>
            this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: {
                    ...command.data,
                    keyword,
                    batchSize,
                    minAckResponses,
                    errorType: this.errorType,
                    networkProtocols: this.operationService.getNetworkProtocols(),
                    proximityScoreFunctionsPairId,
                    paranetId,
                },
                transactional: false,
            }),
        );

        await Promise.all(addCommandPromises);

        return Command.empty();
    }

    async getKeywords(command) {
        const { blockchain, contract, tokenId } = command.data;
        const locationKeyword = await this.ualService.calculateLocationKeyword(
            blockchain,
            contract,
            tokenId,
        );

        return [locationKeyword];
    }

    // TODO: Get batch from paranet size
    async getBatchSize(blockchainId) {
        return this.blockchainModuleManager.getR2(blockchainId);
    }

    async getMinAckResponses() {
        return 0;
    }

    /**
     * Builds default NetworkPublishParanetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkPublishParanetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkPublishParanetCommand;
