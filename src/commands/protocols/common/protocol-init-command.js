import ProtocolMessageCommand from './protocol-message-command.js';
import { NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';

// TODO: Remove anything init
class ProtocolInitCommand extends ProtocolMessageCommand {
    async prepareMessage(command) {
        const { assertionId, contract, tokenId, keyword, hashFunctionId } = command.data;

        // TODO: Backwards compatibility, send blockchain without chainId
        const blockchain = command.data.blockchain.split(':')[0];

        return {
            assertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        };
    }

    async execute(command) {
        return this.executeProtocolMessageCommand(
            command,
            NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT,
        );
    }
}

export default ProtocolInitCommand;
