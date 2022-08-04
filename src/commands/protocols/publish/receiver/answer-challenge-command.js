// const Command = require('../../command');
// const constants = require('../../../constants/constants');
//
// class AnswerChallengeCommand extends Command {
//     constructor(ctx) {
//         super(ctx);
//         this.logger = ctx.logger;
//         this.config = ctx.config;
//         this.networkModuleManager = ctx.networkModuleManager;
//         this.blockchainModuleManager = ctx.blockchainModuleManager;
//         this.validationModuleManager = ctx.validationModuleManager;
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
//         const {
//             handlerId,
//             epoch,
//             blockchain,
//             tokenId
//         } = command.data;
//
//
//         // await this.handlerIdService.updateHandlerIdStatus(
//         //     handlerId,
//         //     HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START,
//         // );
//
//         try {
//             const {data, metadata} = await this.handlerIdService.getCachedHandlerIdData(handlerId);
//
//             const challenge = await this.blockchainModuleManager.getChallenge(blockchain, tokenId, epoch);
//
//             const nquadsArray = data.concat(metadata)
//             const {proof, leaf} = this.validationModuleManager.getMerkleProof(nquadsArray, challenge);
//             await this.blockchainModuleManager.answerChallenge(blockchain, tokenId, epoch, proof, leaf, 0);
//             if (epoch > 0) {
//                 await this.blockchainModuleManager.getReward(blockchain, tokenId, epoch);
//             }
//         }catch(e) {
//             console.log(e);
//         }
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
//             name: 'answerChallengeCommand',
//             delay: 0,
//             transactional: false,
//         };
//         Object.assign(command, map);
//         return command;
//     }
// }
//
// module.exports = AnswerChallengeCommand;
