const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');

class SubmitProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainService = ctx.blockchainService;
        this.dataService = ctx.dataService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { assertion, rdf, handlerId } = command.data;
        try {
            this.logger.info(`Sending transaction to the blockchain: createAssertionRecord(${assertion.id},${assertion.rootHash})`);
            const { transactionHash, blockchain } = await this.blockchainService.sendProofs(assertion);
            this.logger.info(`Transaction hash is ${transactionHash} on ${blockchain}`);

            command.data.assertion.blockchain = {
                name: blockchain,
                transactionHash,
            };

            command.data.rdf = await this.dataService.appendBlockchainMetadata(rdf, assertion);

            const handler = await Models.handler_ids.findOne({
                where: {
                    handler_id: handlerId,
                },
            });
            const handlerData = JSON.parse(handler.data);
            handlerData.blockchain = command.data.assertion.blockchain;
            await Models.handler_ids.update(
                {
                    data: JSON.stringify(handlerData),
                }, {
                    where: {
                        handler_id: handlerId,
                    },
                },
            );
        } catch (e) {
            await this.handleError(handlerId, e, constants.ERROR_TYPE.SUBMIT_PROOFS_ERROR, true);
            return Command.empty();
        }

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            handlerId,
        } = command.data;

        await this.handleError(handlerId, err, constants.ERROR_TYPE.SUBMIT_PROOFS_ERROR, true);

        return Command.empty();
    }

    /**
     * Builds default submitProofsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SubmitProofsCommand;
