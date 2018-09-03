const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Writes root hash to blockchain
 */
class DCOfferRootHashCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
        this.notifyError = ctx.notifyError;
    }

    async execute(command) {
        const {
            offerId,
            importId,
            rootHash,
            importHash,
        } = command.data;

        const result = await this.blockchain.getRootHash(
            this.config.node_wallet,
            importId,
        );
        const blockchainRootHash = result.graph_hash;
        const { data } = command;
        if (blockchainRootHash.toString() === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            this.remoteControl.writingRootHash(importId);
            try {
                const result = await this.blockchain.writeRootHash(importId, rootHash, importHash);
                const dataInfo = await Models.data_info.findOne({
                    where: { import_id: data.importId },
                });
                dataInfo.transaction_hash = result.transactionHash;
                await dataInfo.save({ fields: ['transaction_hash'] });
                this.logger.info('Fingerprint written on blockchain');
            } catch (err) {
                await this._notify(err, offerId);
                throw Error(`Failed to write fingerprint on blockchain. ${err}`);
            }
        } else if (blockchainRootHash !== rootHash) {
            throw Error(`Calculated root hash (${rootHash}) differs from one on blockchain (${blockchainRootHash}).`);
        }

        return this.continueSequence(data, command.sequence);
    }

    /**
     * Notify about the error
     * @param offerId
     * @param err
     * @returns {Promise<void>}
     * @private
     */
    async _notify(err, offerId) {
        if (offerId) {
            const offer = await Models.offers.findOne({ where: { id: offerId } });
            if (offer) {
                offer.status = 'FAILED';
                await offer.save({ fields: ['status'] });
            }
        }
        this.notifyError(err);
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferRootHashCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferRootHashCommand;
