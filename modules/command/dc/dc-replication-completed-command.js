const Command = require('../command');
const Utilities = require('../../Utilities');
const Encryption = require('../../RSAEncryption');
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
            alternativeSignature, response,
        } = command.data;
        try {
            const offer = await Models.offers.findOne({
                where: {
                    offer_id: offerId,
                },
            });
            const { blockchain_id } = offer;

            const replicatedData = await Models.replicated_data.findOne({
                where:
                    {
                        offer_id: offerId, dh_id: dhNodeId,
                    },
            });
            if (!replicatedData) {
                throw new Error(`Failed to find replication for DH node ${dhNodeId}`);
            }

            const { signerOld, signerNew } = this.extractSigners(
                offerId, dhIdentity, replicatedData.color,
                signature, alternativeSignature,
            );

            const confirmation = await this
                .validateSignatures(
                    offerId, dhIdentity, dhWallet,
                    signerOld, signerNew, signature, alternativeSignature, blockchain_id,
                );

            replicatedData.confirmation = confirmation;
            replicatedData.status = 'VERIFIED';
            await replicatedData.save({ fields: ['status', 'confirmation'] });

            await this.transport.sendResponse(response, { status: 'verified', offer_id: offerId });

            if (isReplacement === false) {
                this.logger.notify(`Replication finished for DH node ${dhNodeId}`);
            } else {
                this.logger.notify(`Replacement replication finished for DH node ${dhNodeId}`);
            }
        } catch (error) {
            await this._handleError(command, error);
        }

        return Command.empty();
    }

    extractSigners(offerId, dhIdentity, color, signature, alternativeSignature) {
        const oldConfirmationContent = [
            Utilities.denormalizeHex(offerId),
            Utilities.denormalizeHex(dhIdentity),
        ];
        const signerOld = Encryption.extractSignerAddress(oldConfirmationContent, signature);

        const newConfirmationContent = [
            Utilities.denormalizeHex(offerId),
            Utilities.denormalizeHex(dhIdentity),
            color,
        ];

        const signerNew = alternativeSignature ?
            Encryption.extractSignerAddress(newConfirmationContent, alternativeSignature) :
            Encryption.extractSignerAddress(newConfirmationContent, signature);


        return { signerOld, signerNew };
    }

    async validateSignatures(
        offerId, dhIdentity, dhWallet,
        signerOld, signerNew, signature, alternativeSignature, blockchain_id,
    ) {
        let errorMessage = `Failed to validate DH ${dhWallet} signature for offer ${offerId}. `;

        const oldSignatureMatches = signerOld && Utilities.compareHexStrings(signerOld, dhWallet);
        const newSignatureMatches = signerNew && Utilities.compareHexStrings(signerNew, dhWallet);

        let holdingVersion;
        try {
            holdingVersion = await this.blockchain
                .getContractVersion('HOLDING_CONTRACT', blockchain_id).response;
            holdingVersion = parseInt(holdingVersion, 10);
        } catch (e) {
            if (e.message === 'Contract does not have version variable') {
                holdingVersion = 100;
            } else {
                throw Error('Failed to fetch holding contract version');
            }
        }

        if (holdingVersion >= 101 && newSignatureMatches) {
            const signerHasPermission = await this
                .signerHasPermission(dhIdentity, dhWallet, blockchain_id);

            if (!signerHasPermission) {
                errorMessage += `Extracted signer wallet ${signerNew} `
                    + 'does not have the appropriate permissions set up for the given identity '
                    + `${dhIdentity}.`;
                throw Error(errorMessage);
            }

            return alternativeSignature || signature;
        }

        if (holdingVersion >= 101 && oldSignatureMatches) {
            errorMessage += 'Detected deprecated offer confirmation format, the holder should update their node'
                + ' to be eligible for new offers';
            throw Error(errorMessage);
        }

        if (holdingVersion >= 101 && !oldSignatureMatches && !newSignatureMatches) {
            // TODO In the next version, if the above two checks passed, return this error and
            //      remove the check below
            errorMessage += `Signer wallet does not match the sender wallet ${dhWallet}`;
            throw Error(errorMessage);
        }

        if (holdingVersion < 101 && oldSignatureMatches) {
            const signerHasPermission = await this
                .signerHasPermission(dhIdentity, dhWallet, blockchain_id);

            if (!signerHasPermission) {
                errorMessage += `Extracted signer wallet ${signerOld} `
                    + 'does not have the appropriate permissions set up for the given identity '
                    + `${dhIdentity}.`;
                throw Error(errorMessage);
            }
            return signature;
        }

        errorMessage += `Signer wallet ${signerOld} does not match the sender wallet ${dhWallet}`;
        throw Error(errorMessage);
    }

    async signerHasPermission(dhIdentity, dhWallet, blockchain_id) {
        const purposes = await this.blockchain
            .getWalletPurposes(dhIdentity, dhWallet, blockchain_id).response;

        return purposes.includes(constants.IDENTITY_PERMISSION.encryption);
    }

    async recover(command, error) {
        await this._handleError(command, error);

        return Command.empty();
    }

    async _handleError(command, error) {
        const {
            offerId, dhIdentity, response,
        } = command.data;

        this.logger.warn(`Failed to complete replication for offerId ${offerId} `
            + `and holder identity ${dhIdentity}. ${error.message}`);

        await this.transport.sendResponse(response, { status: 'fail', message: error.message });
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
