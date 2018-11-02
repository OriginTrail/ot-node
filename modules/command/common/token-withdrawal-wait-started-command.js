const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class TokenWithdrawalWaitStartedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            amount,
        } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'WithdrawalInitiated',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    profile: eventProfile,
                } = JSON.parse(e.data);
                return eventProfile.toLowerCase()
                    .includes(this.config.erc725Identity.toLowerCase());
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                const {
                    amount: eAmount,
                    withdrawalDelayInSeconds: eWithdrawalDelayInSeconds,
                } = JSON.parse(event.data);
                this.logger.important(`Token withdrawal for amount ${amount} initiated.`);

                const amountBN = new BN(amount, 10);
                const eAmountBN = new BN(eAmount, 10);
                if (!amountBN.eq(eAmountBN)) {
                    this.logger.warn(`Not enough tokens for withdrawal [${amount}]. All the tokens will be withdrawn [${eAmount}]`);
                }
                const { data } = command;
                Object.assign(data, {
                    amount: eAmount,
                });
                return {
                    commands: [
                        {
                            name: 'tokenWithdrawalCommand',
                            delay: eWithdrawalDelayInSeconds * 1000,
                            data,
                        },
                    ],
                };
            }
        }
        return Command.repeat();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        // TODO implement
        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'tokenWithdrawalWaitStartedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = TokenWithdrawalWaitStartedCommand;
