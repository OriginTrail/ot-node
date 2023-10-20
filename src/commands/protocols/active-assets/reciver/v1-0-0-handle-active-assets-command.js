import HandleProtocolMessageCommand from '../../common/handle-protocol-message-command';

class HandleActiveAssetsCommand extends HandleProtocolMessageCommand {
    async prepareMessage(/* commandData */) {
        // preprare response
        // [{
        // ual, keyword, hashFunctionId
        // }]
    }
}

export default HandleActiveAssetsCommand;
