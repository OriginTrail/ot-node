import { NETWORK_MESSAGE_TYPES, BYTES_IN_MEGABYTE } from '../../../constants/constants.js';

class MessageManager {
    createMessage(messageType, operationId, keywordUuid, data, errorMessage) {
        return {
            header: {
                messageType,
                operationId,
                keywordUuid,
            },
            data: { ...data, errorMessage },
        };
    }

    messageToChunks(message) {
        const stringifiedHeader = JSON.stringify(message.header);
        const stringifiedData = JSON.stringify(message.data);

        const chunks = [stringifiedHeader];
        const chunkSize = BYTES_IN_MEGABYTE; // 1 MB

        // split data into 1 MB chunks
        for (let i = 0; i < stringifiedData.length; i += chunkSize) {
            chunks.push(stringifiedData.slice(i, i + chunkSize));
        }

        return chunks;
    }

    isRequestValid(header) {
        return (
            header?.operationId &&
            header?.keywordUuid &&
            NETWORK_MESSAGE_TYPES.REQUESTS[header?.messageType]
        );
    }

    isResponseValid() {
        return true;
    }
}

export default MessageManager;
