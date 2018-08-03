const uuidv4 = require('uuid/v4');

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
}

module.exports = DVController;

