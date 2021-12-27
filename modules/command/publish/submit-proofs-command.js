const Command = require('../command');
const Models = require("../../../models/index");

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
            const {transactionHash, blockchain } = await this.blockchainService.sendProofs(assertion);
            this.logger.info(`Transaction hash is ${transactionHash} on ${blockchain}`);

            command.data.assertion.blockchain = {
                name: blockchain,
                transactionHash
            }
            command.data.rdf = await this.dataService.appendBlockchainMetadata(rdf, assertion);

            const handler = await Models.handler_ids.findOne({
                where: {
                    handler_id: handlerId,
                },
            });
            let handlerData = JSON.parse(handler.data);
            handlerData.blockchain = command.data.assertion.blockchain;
            await Models.handler_ids.update(
                {
                    data: JSON.stringify(handlerData)
                },{
                    where: {
                        handler_id: handlerId,
                    },
                },
            );

        } catch (e) {
            await Models.handler_ids.update(
                {
                    status: 'FAILED',
                },{
                    where: {
                        handler_id: handlerId,
                    },
                },
            );
            this.logger.error(`Error while sending transaction to the blockchain. ${e.message}`);
            this.logger.emit({
                msg: 'Telemetry logging error at submitting proofs to blockchain command',
                Operation_name: 'Error',
                Event_name: 'SubmitProofsError',
                Event_value1: e.message,
                Id_operation: 'Undefined',
            });

            return Command.empty();
        }

        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default dcConvertToOtJsonCommand
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
