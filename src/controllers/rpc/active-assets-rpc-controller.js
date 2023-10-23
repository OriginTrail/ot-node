import BaseController from './base-rpc-controller.js';

class ActiveAssetsController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationService = ctx.activeAssetsService;
    }

    async v1_0_0HandleRequest(message, remotePeerId, protocol) {
        // const {} = message.header;
        const handleRequestCommand = this.getCommandSequence(protocol)[1];

        const commandName = handleRequestCommand;

        // TODO: Set correct data for command
        await this.commandExecutor.add({
            name: commandName,
            sequence: [],
            delay: 0,
            data: {
                // remotePeerId,
                // operationId,
                // keywordUuid,
                // protocol,
                // assertionId: message.data.assertionId,
                // blockchain: message.data.blockchain,
                // contract: message.data.contract,
                // tokenId: message.data.tokenId,
                // keyword: message.data.keyword,
                // hashFunctionId: message.data.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID,
                // state: message.data.state ?? DEFAULT_GET_STATE,
            },
            transactional: false,
        });
    }
}

export default ActiveAssetsController;
