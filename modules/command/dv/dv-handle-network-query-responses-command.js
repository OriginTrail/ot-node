const Models = require('../../../models/index');
const Command = require('../command');
const BN = require('bn.js');

/**
 * Handles responses (offers) of network queries (data reads).
 */
class DVHandleNetworkQueryResponsesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.network = ctx.network;
        this.web3 = ctx.web3;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const { queryId } = command.data;
        const responseModels = await Models.network_query_responses.findAll({
            where: { query_id: queryId },
        });

        this.logger.trace(`Finalizing query ID ${queryId}. Got ${responseModels.length} offer(s).`);

        let lowestOffer = null;
        responseModels.forEach((response) => {
            const price = new BN(response.data_price, 10);
            if (lowestOffer == null || price.lt(new BN(lowestOffer.data_price, 10))) {
                lowestOffer = response.get({ plain: true });
            }
        });

        const networkQuery = await Models.network_queries.find({ where: { id: queryId } });

        if (!lowestOffer) {
            this.logger.info('Didn\'t find answer or no one replied.');
            this.remoteControl.answerNotFound('Didn\'t find answer or no one replied.');
            networkQuery.status = 'FINISHED';
            await networkQuery.save({ fields: ['status'] });
        } else {
            // Finish auction.
            networkQuery.status = 'PROCESSING';
            await networkQuery.save({ fields: ['status'] });
        }

        if (!lowestOffer) {
            this.logger.info(`No offers for query ${queryId} handled.`);
            this.remoteControl.noOffersForQuery(`No offers for query ${queryId} handled.`);
        } else {
            this.logger.info(`Offers for query ${queryId} are collected`);
            this.remoteControl.networkQueryOffersCollected();
        }

        return Command.empty();
    }

    /**
     * Builds default DVHandleNetworkQueryResponsesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dvHandleNetworkQueryResponsesCommand',
            delay: 0,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        this.logger(`Failed to handle network query. ${err}.`);
        return Command.empty();
    }
}

module.exports = DVHandleNetworkQueryResponsesCommand;
