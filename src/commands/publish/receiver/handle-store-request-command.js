// const Command = require('../../command');
// const constants = require('../../../constants/constants');
//
// class HandleStoreRequestCommand extends Command {
//     constructor(ctx) {
//         super(ctx);
//         this.logger = ctx.logger;
//         this.config = ctx.config;
//         this.networkModuleManager = ctx.networkModuleManager;
//         this.blockchainModuleManager = ctx.blockchainModuleManager;
//         this.dataService = ctx.dataService;
//         this.publishService = ctx.publishService;
//         this.commandExecutor = ctx.commandExecutor;
//         this.ualService = ctx.ualService;
//     }
//
//     /**
//      * Executes command and produces one or more events
//      * @param command
//      */
//     async execute(command) {
//         const { remotePeerId, handlerId, assertionId, metadata, ual } = command.data;
//
//         const messageType = constants.NETWORK_MESSAGE_TYPES.RESPONSES.ACK;
//         const messageData = {};
//         await this.networkModuleManager.sendMessageResponse(
//             constants.NETWORK_PROTOCOLS.STORE,
//             remotePeerId,
//             messageType,
//             handlerId,
//             messageData,
//         );
//
//         // await this.handlerIdService.updateHandlerIdStatus(
//         //     handlerId,
//         //     HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START,
//         // );
//
//         const {tokenId} = this.ualService.resolveUAL(ual);
//         const epochs = await this.blockchainModuleManager.getEpochs(tokenId);
//         const blockNumber = await this.blockchainModuleManager.getBlockNumber();
//         const blockTime = await this.blockchainModuleManager.getBlockTime();
//         const addCommandPromise = [];
//         epochs.forEach((epoch) => {
//             const commandSequence = ['answerChallengeCommand'];
//             addCommandPromise.push(
//                 this.commandExecutor.add({
//                     name: commandSequence[0],
//                     sequence: commandSequence.slice(1),
//                     delay: Math.abs((parseInt(epoch, 10)-parseInt(blockNumber, 10))*parseInt(blockTime, 10)),
//                     data: {
//                         handlerId,
//                         epoch,
//                         tokenId
//                     },
//                     transactional: false,
//                 }),
//             );
//         });
//
//         await Promise.all(addCommandPromise);
//
//         return Command.empty();
//     }
//
//     async handleError(handlerId, errorMessage, errorName, markFailed, commandData) {
//         await this.publishService.handleReceiverCommandError(
//             handlerId,
//             errorMessage,
//             errorName,
//             markFailed,
//             commandData,
//         );
//         return Command.empty();
//     }
//
//     /**
//      * Builds default handleStoreRequestCommand
//      * @param map
//      * @returns {{add, data: *, delay: *, deadline: *}}
//      */
//     default(map) {
//         const command = {
//             name: 'handleStoreRequestCommand',
//             delay: 0,
//             transactional: false,
//         };
//         Object.assign(command, map);
//         return command;
//     }
// }
//
// module.exports = HandleStoreRequestCommand;
