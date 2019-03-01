const BN = require('bn.js');
const Command = require('../command');
const Utilities = require('../../Utilities');

const Models = require('../../../models/index');

const { Op } = Models.Sequelize;

/**
 * Replaces bad DH
 */
class DCOfferReplaceCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.dcService = ctx.dcService;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
        this.replicationService = ctx.replicationService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            solution,
            dhIdentity,
        } = command.data;

        const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
        if (offer.global_status === 'COMPLETED') {
            // offer has already been completed
            this.logger.warn(`Offer ${offerId} has already been completed. Skipping litigation for DH identity ${dhIdentity}`);
            return Command.empty();
        }

        const nodeIdentifiers = solution.nodeIdentifiers.map(ni =>
            Utilities.normalizeHex(ni).toLowerCase());
        const replications = await Models.replicated_data.findAll({
            where: {
                offer_id: offerId,
                dh_identity: { [Op.in]: nodeIdentifiers },
            },
        });

        const colors = [];
        const confirmations = [];
        for (const identity of nodeIdentifiers) {
            const replication = replications.find(r => identity.includes(r.dh_identity));
            colors.push(replication.color);
            confirmations.push(replication.confirmation);
        }

        await this.blockchain.replaceHolder(
            offerId,
            dhIdentity,
            this.config.erc725Identity,
            new BN(solution.shift, 10),
            confirmations[0],
            confirmations[1],
            confirmations[2],
            nodeIdentifiers,
        );

        return {
            commands: [
                {
                    name: 'dcOfferReplacementCompletedCommand',
                    data: {
                        offerId,
                        dhIdentity,
                    },
                    delay: 0,
                    period: 5000,
                    deadline_at: Date.now() + (5 * 60 * 1000),
                },
            ],
        };
    }

    /**
     * Try to recover command
     * @param command
     * @param err
     * @return {Promise<{commands: *[]}>}
     */
    async recover(command, err) {
        const {
            offerId,
            solution,
        } = command.data;

        const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
        const excludedDHs = await this.dcService.checkDhFunds(
            solution.nodeIdentifiers,
            offer.token_amount_per_holder,
        );
        if (excludedDHs.length > 0) {
            // send back to miner
            this.logger.important(`DHs [${excludedDHs}] don't have enough funds for offer ${offerId}. Sending back to miner...`);
            const { data } = command;
            Object.assign(data, {
                excludedDHs,
                internalOfferId: offer.id,
            });
            this.logger.warn(`Failed to finalize offer ${offerId} because some of the DHs didn't have enough funds. Trying again...`);
            return {
                commands: [{
                    name: 'dcOfferChooseCommand',
                    data,
                    transactional: false,
                }],
            };
        }

        this.logger.error(`Offer ${offerId} has not been finalized.`);

        offer.status = 'FAILED';
        offer.global_status = 'FAILED';
        offer.message = `Offer for ${offerId} has not been finalized. ${err.message}`;
        await offer.save({ fields: ['status', 'message', 'global_status'] });
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferReplaceCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferReplaceCommand;
