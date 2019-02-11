const Command = require('../command');
const models = require('../../../models/index');
const Utilities = require('../../Utilities');

const { Op } = models.Sequelize;

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
            isReplacement,
            dhIdentity,
        } = command.data;

        const offer = await models.offers.findOne({ where: { id: internalOfferId } });
        offer.status = 'CHOOSING';
        offer.message = 'Choosing wallets for offer';
        await offer.save({ fields: ['status', 'message'] });

        const replications = await models.replicated_data.findAll({
            where: {
                offer_id: offer.offer_id,
                status: {
                    [Op.in]: ['STARTED', 'VERIFIED'],
                },
            },
        });

        const verifiedReplications = replications.filter(r => r.status === 'VERIFIED');
        if (excludedDHs == null) {
            this.logger.notify(`Replication window for ${offer.offer_id} is closed. Replicated to ${replications.length} peers. Verified ${verifiedReplications.length}.`);
        }

        let identities = verifiedReplications
            .map(r => Utilities.denormalizeHex(r.dh_identity).toLowerCase());

        if (excludedDHs) {
            const normalizedExcludedDHs = excludedDHs
                .map(excludedDH => Utilities.denormalizeHex(excludedDH).toLowerCase());
            identities = identities.filter(identity => !normalizedExcludedDHs.includes(identity));
        }
        if (identities.length < 3) {
            throw new Error('Failed to choose holders. Not enough DHs submitted.');
        }

        let task = null;
        let difficulty = null;
        if (isReplacement) {
            task = await this.blockchain.getLitigationReplacementTask(offer.offer_id, dhIdentity);
            difficulty = await this.blockchain.getLitigationDifficulty(offer.offer_id, dhIdentity);
        } else {
            // eslint-disable-next-line
            task = offer.task;
            difficulty = await this.blockchain.getOfferDifficulty(offer.offer_id);
        }

        await this.minerService.sendToMiner(
            task,
            difficulty,
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
                        isReplacement,
                        dhIdentity,
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
