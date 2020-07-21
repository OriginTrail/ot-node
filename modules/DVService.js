const BN = require('bn.js');
const ethAbi = require('ethereumjs-abi');

const Utilities = require('./Utilities');
const Models = require('../models');
const ImportUtilities = require('./ImportUtilities');
const Encryption = require('./RSAEncryption');
const bytes = require('utf8-length');

/**
 * DV operations (querying network, etc.)
 */
class DVService {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor({
        blockchain, web3, config, graphStorage, logger, remoteControl,
    }) {
        this.blockchain = blockchain;
        this.web3 = web3;
        this.config = config;
        this.graphStorage = graphStorage;
        this.log = logger;
        this.remoteControl = remoteControl;
    }

    async handleEncryptedPaddedKey(message) {
        /*
            message: {
                id,
                wallet,
                nodeId,
                m1,
                m2,
                e,
                r1,
                r2,
                sd, // epkChecksum
                blockNumber,
                import_id,
            }
         */

        const {
            id, wallet, nodeId, m1, m2, e, r1, r2, sd, blockNumber,
            import_id,
        } = message;

        // Check if mine request.

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { reply_id: id },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${id}.`);
        }

        const networkQuery = await Models.network_queries.findOne({
            where: { id: networkQueryResponse.query_id },
        });

        const importId = import_id;

        const m1Checksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(m1, r1, r2));
        const m2Checksum =
            Utilities.normalizeHex(Encryption.calculateDataChecksum(m2, r1, r2, blockNumber + 1));
        const epkChecksumHash =
            Utilities.normalizeHex(ethAbi.soliditySHA3(
                ['uint256'],
                [sd],
            ).toString('hex'));

        // Get checksum from blockchain.
        const purchaseData = await this.blockchain.getPurchasedData(importId, wallet);

        let testNumber = new BN(purchaseData.checksum, 10);
        const r1Bn = new BN(r1);
        const r2Bn = new BN(r2);
        testNumber = testNumber.add(r2Bn).add(r1Bn.mul(new BN(128)));

        if (!testNumber.eq(new BN(Utilities.denormalizeHex(sd), 16))) {
            this.log.warn(`Commitment test failed for reply ID ${id}. Node wallet ${wallet}, import ID ${importId}.`);
            if (await this._litigatePurchase(importId, wallet, nodeId, m1, m2, e)) {
                networkQuery.status = 'FINISHED';
                await networkQuery.save({ fields: ['status'] });
            } else {
                networkQuery.status = 'FAILED';
                await networkQuery.save({ fields: ['status'] });
            }
            throw Error('Commitment test failed.');
        }

        const commitmentHash = Utilities.normalizeHex(ethAbi.soliditySHA3(
            ['uint256', 'uint256', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
            [m1Checksum, m2Checksum, epkChecksumHash, r1, r2, e, blockNumber],
        ).toString('hex'));

        const blockchainCommitmentHash =
            (await this.blockchain.getPurchase(wallet, this.config.node_wallet, importId))
                .commitment;

        if (commitmentHash !== blockchainCommitmentHash) {
            const errorMessage = `Blockchain commitment hash ${blockchainCommitmentHash} differs from mine ${commitmentHash}.`;
            this.log.warn(errorMessage);
            if (await this._litigatePurchase(importId, wallet, nodeId, m1, m2, e)) {
                networkQuery.status = 'FINISHED';
                await networkQuery.save({ fields: ['status'] });
            } else {
                networkQuery.status = 'FAILED';
                await networkQuery.save({ fields: ['status'] });
            }
            throw Error(errorMessage);
        }

        await this.blockchain.confirmPurchase(importId, wallet);

        const encryptedBlockEvent =
            await this.blockchain.subscribeToEvent('EncryptedBlockSent', importId, 60 * 60 * 1000);

        if (encryptedBlockEvent) {
            // DH signed the escrow. Yay!
            const purchase =
                await this.blockchain.getPurchase(wallet, this.config.node_wallet, importId);
            const epk = m1 +
                Buffer.from(
                    Encryption.xor(
                        Utilities.expandHex(new BN(purchase.encrypted_block).toString('hex'), 64),
                        Utilities.denormalizeHex(e),
                    ),
                    'hex',
                ).toString('ascii') + m2;

            try {
                const publicKey = Encryption.unpackEPK(epk);
                await Models.holding_data.create({
                    id: importId,
                    source_wallet: wallet,
                    data_public_key: publicKey,
                    distribution_public_key: publicKey,
                    epk,
                });
                networkQuery.status = 'FINISHED';
                await networkQuery.save({ fields: ['status'] });
            } catch (err) {
                this.log.warn(`Invalid purchase decryption key, Reply ID ${id}, wallet ${wallet}, import ID ${importId}.`);
                if (await this._litigatePurchase(importId, wallet, nodeId, m1, m2, e)) {
                    networkQuery.status = 'FINISHED';
                    await networkQuery.save({ fields: ['status'] });
                } else {
                    networkQuery.status = 'FAILED';
                    await networkQuery.save({ fields: ['status'] });
                }
                return;
            }

            this.log.info(`[DV] Purchase ${importId} finished. Got key.`);
            this.remoteControl.purchaseFinished(`[DV] Purchase ${importId} finished. Got key.`, importId);
        } else {
            // Didn't sign escrow. Cancel it.
            this.log.info(`DH didn't sign the escrow. Canceling it. Reply ID ${id}, wallet ${wallet}, import ID ${importId}.`);
            await this.blockchain.cancelPurchase(importId, wallet, false);
            networkQuery.status = 'FAILED';
            await networkQuery.save({ fields: ['status'] });
            this.log.info(`Purchase for import ID ${importId} canceled.`);
        }
    }

    async _litigatePurchase(importId, wallet, nodeId, m1, m2, e) {
        // Initiate despute here.
        await this.blockchain.initiateDispute(importId, wallet);

        // Wait for event.
        // emit PurchaseDisputeCompleted(import_id, msg.sender, DV_wallet, true);

        const purchaseDisputeCompleted =
            await this.blockchain.subscribeToEvent('PurchaseDisputeCompleted', importId, 60 * 60 * 1000);

        if (purchaseDisputeCompleted.proof_was_correct) {
            // Ups, should never happened.
            this.log.warn(`Contract claims litigation was unfortunate for me. Import ID ${importId}`);

            // Proceed like nothing happened.
            const purchase =
                await this.blockchain.getPurchase(wallet, this.config.node_wallet, importId);
            const epk = m1 + Encryption.xor(purchase.encrypted_block, e) + m2;
            const publicKey = Encryption.unpackEPK(epk);

            await Models.holding_data.create({
                id: importId,
                source_wallet: wallet,
                data_public_key: publicKey,
                distribution_public_key: publicKey,
                epk,
            });

            return false;
        }

        this.log.warn(`Contract claims litigation was fortunate for me. Import ID ${importId}`);
        return true;
    }
}

module.exports = DVService;
