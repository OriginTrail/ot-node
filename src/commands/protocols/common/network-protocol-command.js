import Command from '../../command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../constants/constants.js';

class NetworkProtocolCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.errorType = ERROR_TYPE.NETWORK_PROTOCOL_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.NETWORK_PROTOCOL_START;
        this.operationEndEvent = OPERATION_ID_STATUS.NETWORK_PROTOCOL_END;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain, operationId, minimumNumberOfNodeReplications, batchSize } =
            command.data;

        this.operationIdService.emitChangeEvent(this.operationStartEvent, operationId, blockchain);

        const batchSizePar = this.operationService.getBatchSize(batchSize);
        const minAckResponses = this.operationService.getMinAckResponses(
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
                batchSize: batchSizePar,
                minAckResponses,
                errorType: this.errorType,
            },
            transactional: false,
        });

        this.operationIdService.emitChangeEvent(this.operationEndEvent, operationId, blockchain);

        return Command.empty();
    }

    getBatchSize() {
        throw Error('getBatchSize not implemented');
    }

    getMinAckResponses() {
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
