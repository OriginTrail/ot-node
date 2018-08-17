const uuidv4 = require('uuid/v4');
const Models = require('../../models');

/**
 * Encapsulates DV related methods
 */
class DVController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Sends query to the network.
     * @param query Query
     * @returns {Promise<*>}
     */
    async queryNetwork(query) {
        const queryId = uuidv4();

        await this.commandExecutor.add({
            name: 'dvQueryNetworkCommand',
            delay: 0,
            data: {
                queryId,
                query,
            },
            transactional: false,
        });

        return queryId;
    }

    /**
     * Handles network queries and chose lowest offer if any.
     * @param queryId {String} ID of the query.
     * @param totalTime {Number}Time to wait for offers
     * @returns {Promise} Lowest offer. May be null.
     */
    handleQuery(queryId, totalTime = 60000) {
        this.commandExecutor.add({
            name: 'dvHandleNetworkQueryResponsesCommand',
            ready_at: Date.now() + totalTime,
            data: {
                queryId,
            },
            transactional: false,
        });
    }

    /**
     * Handles data read request
     * @param queryId
     * @param importId
     * @param replyId
     */
    handleDataReadRequest(queryId, importId, replyId) {
        this.commandExecutor.add({
            name: 'dvDataReadRequestCommand',
            delay: 0,
            data: {
                queryId,
                importId,
                replyId,
            },
            transactional: false,
        });
    }

    async handleDataLocationResponse(message) {
        const queryId = message.id;

        // Find the query.
        const networkQuery = await Models.network_queries.findOne({
            where: { id: queryId },
        });

        if (!networkQuery) {
            throw Error(`Didn't find query with ID ${queryId}.`);
        }

        if (networkQuery.status !== 'OPEN') {
            throw Error('Too late. Query closed.');
        }

        await this.commandExecutor.add({
            name: 'dvDataLocationResponseCommand',
            delay: 0,
            data: {
                queryId,
                wallet: message.wallet,
                nodeId: message.nodeId,
                imports: message.imports,
                dataPrice: message.dataPrice,
                dataSize: message.dataSize,
                stakeFactor: message.stakeFactor,
                replyId: message.replyId,
            },
            transactional: false,
        });
    }
    async handleDataReadResponseFree(message) {
        /*
            message: {
                id: REPLY_ID
                wallet: DH_WALLET,
                nodeId: KAD_ID
                agreementStatus: CONFIRMED/REJECTED,
                encryptedData: { … }
                importId: IMPORT_ID,        // Temporal. Remove it.
            },
         */

        // Is it the chosen one?
        const replyId = message.id;

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { reply_id: replyId },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${replyId}.`);
        }

        const networkQuery = await Models.network_queries.findOne({
            where: { id: networkQueryResponse.query_id },
        });
        await this.commandExecutor.add({
            name: 'dvDataReadResponseFreeCommand',
            delay: 0,
            data: {
                message,
            },
            transactional: false,
        });
    }
}

module.exports = DVController;

