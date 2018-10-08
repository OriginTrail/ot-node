const Command = require('../command');
const models = require('../../../models/index');

/**
 * Creates offer on blockchain
 */
class DCOfferChooseCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
        this.minerService = ctx.minerService;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            internalOfferId,
        } = command.data;

        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'CHOOSING';
        offer.message = 'Choosing wallets for offer';
        await offer.save({ fields: ['status', 'message'] });

        const replications = await models.replicated_data.findAll({
            where: {
                offer_id: offer.offer_id,
                status: 'VERIFIED',
            },
        });

        // if (replications.length < 3) {
        //     throw new Error();
        // }

        // const wallets = replications.map(r => r.dh_wallet);
        const w1 = '0000000000000000000000000000000000000000';
        const w2 = '0000000000000000000000000000000000000001';
        const w3 = '0000000000000000000000000000000000000002';

        const wallets = [w1, w2, w3];
        this.minerService.sendToMiner(
            offer.task,
            wallets.concat(wallets).concat(wallets),
            offer.offer_id,
        );
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferChooseCommand',
            delay: 20000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferChooseCommand;
