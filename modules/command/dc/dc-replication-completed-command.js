const Command = require('../command');
const Utilities = require('../../Utilities');
const encryption = require('../../RSAEncryption');
const Models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Handles replication request
 */
class DcReplicationCompletedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Creates an offer in the database
     * @param command
     * @returns {Promise<{commands}>}
     */
    async execute(command) {
        const {
            offerId, dhNodeId,
            dhWallet, dhIdentity,
            signature, isReplacement,
        } = command.data;

        const toValidate = [
            Utilities.denormalizeHex(offerId),
            Utilities.denormalizeHex(dhIdentity)];
        const address = encryption.extractSignerAddress(toValidate, signature);

        const offer = await Models.offers.findOne({
            where: {
                offer_id: offerId,
            },
        });
        const { blockchain_id } = offer;

        let validationFailed = false;
        let message = '';

        const purposes = await this.blockchain
            .getWalletPurposes(dhIdentity, address, blockchain_id).response;
        if (!purposes.includes(constants.IDENTITY_PERMISSION.encryption)) {
            validationFailed = true;
            message += `Extracted signer wallet ${address} does not have the appropriate permissions set up for the given identity ${dhIdentity}. `;
        }

        if (!Utilities.compareHexStrings(address, dhWallet)) {
            validationFailed = true;
            message += `Signer wallet ${address} does not match the sender wallet ${dhWallet}`;
        }

        if (validationFailed) {
            throw Error(`Failed to validate DH ${dhWallet} signature for offer ${offerId}. ${message}`);
        }

        const replicatedData = await Models.replicated_data.findOne({
            where:
                {
                    offer_id: offerId, dh_id: dhNodeId,
                },
        });
        if (!replicatedData) {
            throw new Error(`Failed to find replication for DH node ${dhNodeId}`);
        }
        replicatedData.confirmation = signature;
        replicatedData.status = 'VERIFIED';
        await replicatedData.save({ fields: ['status', 'confirmation'] });

        if (isReplacement === false) {
            this.logger.notify(`Replication finished for DH node ${dhNodeId}`);
        } else {
            this.logger.notify(`Replacement replication finished for DH node ${dhNodeId}`);
        }
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcReplicationCompletedCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcReplicationCompletedCommand;
