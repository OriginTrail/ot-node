const BN = require('../../../node_modules/bn.js/lib/bn');
const bytes = require('utf8-length');

const Command = require('../command');
const MerkleTree = require('../../Merkle');
const Encryption = require('../../RSAEncryption');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');
const ImportUtilities = require('../../ImportUtilities');

/**
 * Imports data for replication
 */
class DHReplacementImportCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
        this.graphStorage = ctx.graphStorage;
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.remoteControl = ctx.remoteControl;
        this.challengeService = ctx.challengeService;
        this.profileService = ctx.profileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            litigatorIdentity,
        } = command.data;

        // Check if ERC725 has valid node ID.
        const profile =
            await this.blockchain.getProfile(Utilities.normalizeHex(litigatorIdentity)).response;
        const dcNodeId = Utilities.denormalizeHex(profile.nodeId.toLowerCase()).substring(0, 40);

        this.logger.trace(`Sending replacement request for offer ${offerId} to ${dcNodeId}.`);
        // todo pass blockchain identity
        const response = await this.transport.replacementReplicationRequest({
            offerId,
            wallet: this.config.node_wallet,
            dhIdentity: this.profileService.getIdentity(),
        }, dcNodeId);

        this.logger.info(`Replacement replication request for ${offerId} sent to ${dcNodeId}`);

        if (response.status === 'fail') {
            const bid = await Models.bids.findOne({
                where: {
                    offer_id: offerId,
                },
            });

            bid.status = 'FAILED';
            let message = `Failed to receive replacement replication from ${dcNodeId} for offer ${offerId}.`;
            if (response.message != null) {
                message = `${message} Data creator reason: ${response.message}`;
            }

            bid.message = message;
            await bid.save({ fields: ['status', 'message'] });
            this.logger.warn(message);
            return Command.empty();
        }

        const {
            data_set_id: dataSetId,
            edges,
            litigation_vertices: litigationVertices,
            dc_wallet: dcWallet,
            litigation_public_key: litigationPublicKey,
            distribution_public_key: distributionPublicKey,
            distribution_private_key: distributionPrivateKey,
            distribution_epk_checksum: distributionEpkChecksum,
            distribution_root_hash: distributionRootHash,
            distribution_epk: distributionEpk,
            distribution_signature: distributionSignature,
            transaction_hash: transactionHash,
            litigation_root_hash: litigationRootHash,
            color: encColor,
        } = response;

        const decryptedVertices =
            await ImportUtilities.immutableDecryptVertices(litigationVertices, litigationPublicKey);
        const calculatedDataSetId =
            await ImportUtilities.importHash(dataSetId, decryptedVertices, edges);

        if (dataSetId !== calculatedDataSetId) {
            throw new Error(`Calculated data set ID ${calculatedDataSetId} differs from DC data set ID ${dataSetId}`);
        }

        ImportUtilities.sort(litigationVertices);
        const litigationBlocks = this.challengeService.getBlocks(litigationVertices);
        const litigationBlocksMerkleTree = new MerkleTree(litigationBlocks, 'litigation');
        const calculatedLitigationRootHash = litigationBlocksMerkleTree.getRoot();

        if (litigationRootHash !== calculatedLitigationRootHash) {
            throw new Error(`Calculated litigation hash ${calculatedLitigationRootHash} differs from DC litigation hash ${litigationRootHash}`);
        }

        const distEncVertices = ImportUtilities.immutableEncryptVertices(
            decryptedVertices,
            distributionPrivateKey,
        );
        const calculatedDistributionRootHash = (await ImportUtilities.merkleStructure(
            distEncVertices,
            edges,
        )).tree.getRoot();

        if (distributionRootHash !== calculatedDistributionRootHash) {
            throw new Error(`Calculated distribution hash ${calculatedLitigationRootHash} differs from DC distribution hash ${litigationRootHash}`);
        }

        const calculatedDistEpkChecksum = Encryption
            .calculateDataChecksum(distributionEpk, 0, 0, 0);
        if (distributionEpkChecksum !== calculatedDistEpkChecksum) {
            throw new Error(`Calculated distribution EPK checksum ${calculatedDistEpkChecksum} differs from DC distribution EPK checksum ${distributionEpkChecksum}`);
        }

        const toCheck = [
            Utilities.denormalizeHex(new BN(distributionEpkChecksum).toString('hex')),
            Utilities.denormalizeHex(distributionRootHash),
        ];
        const senderAddress = Encryption.extractSignerAddress(toCheck, distributionSignature);
        if (!Utilities.compareHexStrings(senderAddress, dcWallet)) {
            throw new Error(`Failed to validate DC ${dcWallet} signature for offer ${offerId}`);
        }

        const calculatedDistPublicKey = Encryption.unpackEPK(distributionEpk);
        ImportUtilities.immutableDecryptVertices(distEncVertices, calculatedDistPublicKey);

        const holdingData = await Models.holding_data.findOne({
            where: {
                offer_id: offerId,
                data_set_id: dataSetId,
                color: encColor,
            },
        });

        // if (holdingData == null) {
        //     // import does not exist
        //
        //     await this.importer.importJSON({
        //         dataSetId,
        //         vertices: litigationVertices,
        //         edges,
        //         wallet: dcWallet,
        //     }, true, encColor);
        // }

        // Store holding information and generate keys for eventual data replication.
        await Models.holding_data.create({
            data_set_id: dataSetId,
            source_wallet: dcWallet,
            litigation_public_key: litigationPublicKey,
            litigation_root_hash: litigationRootHash,
            distribution_public_key: distributionPublicKey,
            distribution_private_key: distributionPrivateKey,
            distribution_epk: distributionEpk,
            transaction_hash: transactionHash,
            color: encColor,
            offer_id: offerId,
        });

        const dataInfo = await Models.data_info.findOne({
            where: {
                data_set_id: dataSetId,
            },
        });

        if (dataInfo == null) {
            // TODO refactor with new importer
            // let importResult = await this.importer.importJSON({
            //     dataSetId,
            //     vertices: decryptedVertices,
            //     edges,
            //     wallet: dcWallet,
            // }, false);

            let importResult;

            if (importResult.error) {
                throw Error(importResult.error);
            }

            importResult = importResult.response;

            const dataSize = bytes(JSON.stringify(importResult.vertices));
            await Models.data_info.create({
                data_set_id: importResult.data_set_id,
                total_documents: importResult.vertices.length,
                root_hash: importResult.root_hash,
                data_provider_wallets: importResult.wallet,
                import_timestamp: new Date(),
                data_size: dataSize,
                origin: 'HOLDING',
            });
        }

        this.logger.important(`[DH] Replacement replication finished for offer ID ${offerId}`);

        // todo pass blockchain identity
        const toSign = [
            Utilities.denormalizeHex(offerId),
            Utilities.denormalizeHex(this.profileService.getIdentity())];
        const messageSignature = Encryption
            .signMessage(toSign, Utilities.normalizeHex(this.config.node_private_key));

        // todo pass blockchain identity
        const replicationFinishedMessage = {
            offerId,
            dhIdentity: this.profileService.getIdentity(),
            messageSignature: messageSignature.signature,
        };

        await this.transport.replacementReplicationFinished(replicationFinishedMessage, dcNodeId);
        return {
            commands: [
                {
                    name: 'dhReplacementCompletedCommand',
                    deadline_at: Date.now() + (60 * 60 * 1000), // One hour.
                    period: 10 * 1000,
                    data: {
                        offerId,
                    },
                },
            ],
        };
    }

    /**
     * Parse network response
     * @param response  - Network response
     * @private
     */
    static _stripResponse(response) {
        return {
            offerId: response.offer_id,
            dataSetId: response.data_set_id,
            edges: response.edges,
            litigationVertices: response.litigation_vertices,
            dcWallet: response.dc_wallet,
            litigationPublicKey: response.litigation_public_key,
            distributionPublicKey: response.distribution_public_key,
            distributionPrivateKey: response.distribution_private_key,
            distributionEpkChecksum: response.distribution_epk_checksum,
            litigationRootHash: response.litigation_root_hash,
            distributionRootHash: response.distribution_root_hash,
            distributionEpk: response.distribution_epk,
            distributionSignature: response.distribution_signature,
            transactionHash: response.transaction_hash,
            encColor: response.color,
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
        } = command.data;

        const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
        bid.status = 'FAILED';
        await bid.save({ fields: ['status'] });
        return Command.empty();
    }

    /**
     * Builds default
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhReplacementImportCommand',
            delay: 10000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHReplacementImportCommand;
