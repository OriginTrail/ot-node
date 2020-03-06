const Command = require('../command');
const models = require('../../../models');
const bugsnag = require('bugsnag');

/**
 *  Checks one DH's challenge response
 */
class DCChallengeCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            dhId,
            challengeId,
            offerId,
            dhIdentity,
            litigationPrivateKey,
        } = command.data;

        const challenge = await models.challenges.findOne({ where: { id: challengeId } });

        const replicatedData = await models.replicated_data.findOne({
            where:
                {
                    offer_id: offerId, dh_id: dhId,
                },
        });

        if (challenge.answer === challenge.expected_answer) {
            this.logger.trace(`Holder ${dhIdentity} successfully answered to challenge for offer ${offerId}.`);

            replicatedData.status = 'HOLDING';
            await replicatedData.save({ fields: ['status'] });

            challenge.status = 'SUCCESSFUL';
            await challenge.save({ fields: ['status'] });
            return Command.empty();
        }
        let bugsnagMessage = 'Challenge check failed. Initiating litigation. ';
        if (!challenge || !challenge.answer) {
            bugsnagMessage = `${bugsnagMessage}No answer from challenged Node!`;
        } else {
            bugsnagMessage = `${bugsnagMessage}Node responded with wrong answer!`;
        }
        bugsnag.notify(bugsnagMessage, {
            user: {
                id: challenge.dh_id,
                dc_identity: this.config.identity,
                dh_identity: dhIdentity,
                challenge_id: challenge.id,
                data_set_id: challenge.data_set_id,
                object_index: challenge.object_index,
                block_index: challenge.block_index,
                expected_answer: challenge.expected_answer,
                answer: challenge.answer,
            },
            severity: 'info',
        });

        this.logger.info(`Wrong answer to challenge '${challenge.id}' for DH ID ${challenge.dh_id}. Got ${challenge.answer} for expected answer ${challenge.expected_answer}.`);
        return {
            commands: [
                {
                    name: 'dcLitigationInitiateCommand',
                    period: 5000,
                    data: {
                        offerId,
                        objectIndex: challenge.object_index,
                        blockIndex: challenge.block_index,
                        dhIdentity,
                        litigationPrivateKey,
                    },
                },
            ],
        };
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            name: 'dcChallengeCheckCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCChallengeCheckCommand;
