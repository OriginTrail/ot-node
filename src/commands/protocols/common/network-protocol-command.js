import Command from '../../command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../constants/constants.js';

class NetworkProtocolCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;

        this.errorType = ERROR_TYPE.NETWORK_PROTOCOL_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.NETWORK_PROTOCOL_START;
        this.operationEndEvent = OPERATION_ID_STATUS.NETWORK_PROTOCOL_END;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain, operationId, minimumNumberOfNodeReplications, userDefinedBatchSize } =
            command.data;

        this.operationIdService.emitChangeEvent(this.operationStartEvent, operationId, blockchain);

        const batchSize = await this.operationService.getBatchSize(
            blockchain,
            userDefinedBatchSize,
        );

        const minAckResponses = await this.operationService.getMinAckResponses(
            blockchain,
            minimumNumberOfNodeReplications,
        );

        const commandSequence = [
            `${this.operationService.getOperationName()}ScheduleMessagesCommand`,
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: {
                ...command.data,
                batchSize,
                minAckResponses,
                errorType: this.errorType,
            },
            transactional: false,
        });

        this.operationIdService.emitChangeEvent(this.operationEndEvent, operationId, blockchain);

        return Command.empty();
    }

    async getKeywords() {
        throw Error('getKeywords not implemented');
    }

    async getBatchSize() {
        throw Error('getBatchSize not implemented');
    }

    async getMinAckResponses() {
        throw Error('getMinAckResponses not implemented');
    }

    /**
     * Builds default protocolNetworkCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'protocolNetworkCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default NetworkProtocolCommand;
