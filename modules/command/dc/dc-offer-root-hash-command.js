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
    }

    async execute(command) {
        const {
            offerId,
            importId,
            rootHash,
        } = command.data;

        const offer = await Models.offers.findOne({ where: { id: offerId } });

        const blockchainRootHash = await this.blockchain.getRootHash(
            this.config.node_wallet,
            importId,
        );
        if (blockchainRootHash.toString() === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            this.remoteControl.writingRootHash(importId);
            try {
                await this.blockchain.writeRootHash(importId, rootHash);
                this.logger.info('Fingerprint written on blockchain');
            } catch (err) {
                offer.status = 'FAILED';
                await offer.save({ fields: ['status'] });
                throw Error(`Failed to write fingerprint on blockchain. ${err}`);
            }
        } else if (blockchainRootHash !== rootHash) {
            throw Error(`Calculated root hash (${rootHash}) differs from one on blockchain (${blockchainRootHash}).`);
        }

        return this.continueSequence(command.data, command.sequence);
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
