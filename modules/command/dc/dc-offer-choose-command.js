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
        this.replicationService = ctx.replicationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            internalOfferId,
            excludedDHs,
        } = command.data;

        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'CHOOSING';
        offer.message = 'Choosing wallets for offer';
        await offer.save({ fields: ['status', 'message'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });

        const replications = await models.replicated_data.findAll({
            where: {
                offer_id: offer.offer_id,
                status: 'VERIFIED',
            },
        });

        const verifiedReplications = replications.map(r => r.status === 'VERIFIED');
        if (excludedDHs == null) {
            this.logger.notify(`Replication window for ${offer.offer_id} is closed. Replicated to ${replications.length} peers. Verified ${verifiedReplications.length}.`);
        }

        let identities = replications
            .map(r => Utilities.denormalizeHex(r.dh_identity).toLowerCase());
        if (excludedDHs) {
            const normalizedExcludedDHs = excludedDHs
                .map(excludedDH => Utilities.denormalizeHex(excludedDH).toLowerCase());
            identities = identities.filter(identity => !normalizedExcludedDHs.includes(identity));
        }
        if (identities.length < 3) {
            throw new Error('Failed to choose holders. Not enough DHs submitted.');
        }

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
                        excludedDHs,
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
        const { internalOfferId } = command.data;
        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'FAILED';
        offer.message = err.message;
        await offer.save({ fields: ['status', 'message'] });
        this.remoteControl.offerUpdate({
            id: internalOfferId,
        });

        await this.replicationService.cleanup(offer.id);
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
            delay: this.config.dc_choose_time,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferChooseCommand;
