const {
    HANDLER_ID_STATUS,
    NETWORK_PROTOCOLS,
    NETWORK_MESSAGE_TYPES,
} = require('../../constants/constants');
const BaseController = require('./base-controller');

class ResolveController extends BaseController {
    async handleHttpApiResolveRequest(req, res) {
        const operationId = this.generateOperationId();

        let { id } = req.body;

        const handlerId = await this.handlerIdService.generateHandlerId();

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.VALIDATING_ID,
        );

        this.returnResponse(res, 202, {
            handlerId,
        });

        this.logger.info(`Resolve for ${id} with handler id ${handlerId} initiated.`);

        if (id.startsWith('dkg://')) {
            id = id.split('/').pop();

            const { assertionId } = await this.blockchainService.getAssetProofs(id);
            if (assertionId) {
                id = assertionId;
            }
        }
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVING_ASSERTION,
        );

        let nquads = await this.tripleStoreModuleManager.resolve(id, true);
        if (nquads.length) {
            nquads = nquads.toString();
            nquads = nquads.split('\n');
            nquads = nquads.filter((x) => x !== '');
        } else {
            nquads = null;
        }

        if (!nquads) {
            this.logger.info(
                `Searching for closest ${this.config.replicationFactor} node(s) for keyword ${id}`,
            );

            const foundNodes = await this.networkModuleManager.findNodes(
                id,
                NETWORK_PROTOCOLS.RESOLVE,
            );

            const nodes = await this.networkModuleManager.rankNodes(
                foundNodes,
                id,
                this.config.replicationFactor,
            );
            if (nodes.length < this.config.replicationFactor) {
                this.logger.warn(`Found only ${nodes.length} node(s) for keyword ${id}`);
            }

            const resolvePromises = nodes.map((node) =>
                this.networkModuleManager.sendMessage(NETWORK_PROTOCOLS.RESOLVE, id, node),
            );

            nquads = await Promise.any(resolvePromises);
        }

        try {
            await this.handlerIdService.cacheHandlerIdData(handlerId, nquads);
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.COMPLETED,
            );
        } catch (e) {
            await this.handlerIdService.updateFailedHandlerId(handlerId, e.message);
        }
    }

    async handleNetworkResolveRequest(message, remotePeerId) {
        const operationId = await this.generateHandlerId();
        let commandName;
        const commandData = { message, remotePeerId, operationId };
        switch (message.header.messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandName = 'handleResolveInitCommand';
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandName = 'handleResolveRequestCommand';
                break;
            default:
                throw Error('unknown messageType');
        }

        await this.commandExecutor.add({
            name: commandName,
            sequence: [],
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }
}

module.exports = ResolveController;
