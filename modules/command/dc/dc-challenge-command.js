const Command = require('../command');
const utilities = require('../../Utilities');
const models = require('../../../models/index');
const constants = require('../../utility/constants');
const importUtilities = require('../../ImportUtilities');

/**
 *  Challenges one DH
 */
class DCChallengeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            dhId,
            offerId,
            dataSetId,
            litigationPrivateKey,
        } = command.data;

        const numberOfTests = constants.DEFAULT_CHALLENGE_NUMBER_OF_TESTS;

        const offer = await models.offers.findOne({ where: { offer_id: offerId } });
        const vertices = await this.graphStorage.findVerticesByImportId(offer.data_set_id, false);

        const encryptedVertices = importUtilities.immutableEncryptVertices(
            vertices,
            litigationPrivateKey,
        );
        const challenges = this.challengeService.generateChallenges(
            numberOfTests,
            constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES,
            encryptedVertices,
        );
        const challenge = challenges[utilities.getRandomInt(numberOfTests - 1)];

        this.logger.trace(`Sending challenge to ${dhId}. Import ID ${dataSetId}, block ID ${challenge.block_id}.`);

        const response = await this.transport.challengeRequest({
            payload: {
                data_set_id: offer.data_set_id,
                block_id: challenge.block_id,
            },
        }, dhId);

        const status = this.transport.extractResponseStatus(response);
        if (typeof status === 'undefined') {
            this.logger.warn('challenge-request: Missing status');
            return Command.empty();
        }

        if (status !== 'success') {
            this.logger.trace('challenge-request: Response not successful.');
            return Command.empty();
        }

        if (response.answer === challenge.answer) {
            this.logger.trace('Successfully answered to challenge.');
        } else {
            this.logger.info(`Wrong answer to challenge '${response.answer} for DH ID ${challenge.dh_id}.'`);
        }
        return Command.empty();
    }
}

module.exports = DCChallengeCommand;
