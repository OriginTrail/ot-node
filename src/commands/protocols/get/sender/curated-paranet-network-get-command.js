import Command from '../../../command.js';
import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE } from '../../../../constants/constants.js';

class CuratedParanetNetworkGetCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.GET.GET_NETWORK_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain } = command.data;

        const keywords = await this.getKeywords(command);
        const batchSize = await this.getBatchSize(blockchain);
        const minAckResponses = await this.getMinAckResponses(blockchain);

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

    async getBatchSize() {
        return 2;
    }

    async getMinAckResponses() {
        return 1;
    }

    /**
     * Builds default curatedParanetNetworkGetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'curatedParanetNetworkGetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default CuratedParanetNetworkGetCommand;
