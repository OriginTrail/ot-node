const Command = require('../command');
const models = require('../../../models/index');
const Utilities = require('../../Utilities');

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

        if (replications.length < 3) {
            throw new Error('Failed to choose holders. Not enough DHs submitted.');
        }

        const identities = replications.map(r => Utilities.denormalizeHex(r.dh_identity));
        await this.minerService.sendToMiner(
            offer.task,
            identities,
            offer.offer_id,
        );
        return {
            commands: [
                {
                    name: 'dcOfferMiningStatusCommand',
                    delay: 0,
                    period: 5000,
                    data: {
                        offerId: offer.offer_id,
                    },
                },
            ],
        };
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { offerId } = command.data;
        const offer = await models.offers.findOne({ where: { id: offerId } });
        offer.status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message'] });
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferChooseCommand',
            delay: 30000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferChooseCommand;
