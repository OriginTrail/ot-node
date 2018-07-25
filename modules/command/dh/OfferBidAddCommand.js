const Command = require('../Command');

class OfferBidAddCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            importId, predetermined,
        } = command.data;

        if (predetermined) {
            const myBidIndex = await this.blockchain.getBidIndex(
                importId,
                this.config.identity,
            );
            await this.blockchain.activatePredeterminedBid(
                importId,
                this.config.identity,
                myBidIndex,
            );
        } else {
            await this.blockchain.addBid(importId, this.config.identity);
        }

        return {
            commands: [
                {
                    name: 'offerBidAdded',
                    data: command.data,
                    delay: 0,
                },
            ],
        };
    }

    /**
     * Recover system from failure
     * @param command
     * @param transaction
     * @param err
     */
    recover(command, err) {
        this.logger.info('Bid not added, your bid was probably too late and the offer has been closed');
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'offerBidAdd',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OfferBidAddCommand;
