const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../constants');
const sortedStringify = require("json-stable-stringify");

class SubmitProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchainService = ctx.blockchainService;
        this.dataService = ctx.dataService;
        this.fileService = ctx.fileService;
        this.workerPool = ctx.workerPool;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { documentPath, handlerId, method } = command.data;

        try {
            let { nquads, assertion } = await this.fileService.loadJsonFromFile(documentPath);

            this.logger.info(`Sending transaction to the blockchain`);
            let result;
            switch (method) {
                case 'publish':
                    result = await this.blockchainService.createAssertionRecord(assertion.id, assertion.rootHash);
                    break;
                case 'provision':
                    result = await this.blockchainService.registerAsset(assertion.metadata.UALs[0],assertion.metadata.type,assertion.metadata.UALs[0],assertion.id, assertion.rootHash, 1);
                    break;
                case 'update':
                    result = await this.blockchainService.updateAsset(assertion.metadata.UALs[0],assertion.id, assertion.rootHash);
                    break;
            }
            const { transactionHash, blockchain } = result;
            this.logger.info(`Transaction hash is ${transactionHash} on ${blockchain}`);

            assertion.blockchain = {
                name: blockchain,
                transactionHash,
            };

            nquads = await this.dataService.appendBlockchainMetadata(nquads, assertion);
            const handlerIdCachePath = this.fileService.getHandlerIdCachePath();

            await this.fileService
                .writeContentsToFile(handlerIdCachePath, handlerId, sortedStringify({
                    nquads, assertion
                }));

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
