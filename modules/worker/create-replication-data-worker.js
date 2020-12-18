const fs = require('fs');
const Encryption = require('../RSAEncryption');
const ImportUtilities = require('../ImportUtilities');
const OtJsonUtilities = require('../OtJsonUtilities');
const ChallengeService = require('../service/challenge-service');
const Utilities = require('../Utilities');
const path = require('path');

process.on('message', async (data) => {
    const {
        handler_id, cacheDirectoryPath, config, dataSetId,
    } = JSON.parse(data);
    try {
        const documentPath = path.join(cacheDirectoryPath, handler_id);

        let document = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));
        const {
            vertices,
            edges,
            metadata,
        } = document;

        document = {
            '@id': dataSetId,
            '@type': 'Dataset',
            '@graph': await ImportUtilities.createDocumentGraph(vertices, edges),
        };

        document.datasetHeader = metadata.datasetHeader;
        document.signature = metadata.signature;

        const otJson = OtJsonUtilities.prepareDatasetForDatabaseRead(document);
        ImportUtilities.removeGraphPermissionedData(otJson['@graph']);

        await Utilities.writeContentsToFile(cacheDirectoryPath, handler_id, JSON.stringify(otJson));

        const writeFilePromises = [];
        const hashes = {};
        const colors = ['red', 'blue', 'green'];
        for (let i = 0; i < 3; i += 1) {
            const color = colors[i];
            const litigationKeyPair = Encryption.generateKeyPair(2048);
            const distributionKeyPair = Encryption.generateKeyPair(512);

            let encryptedDataset =
                ImportUtilities.encryptDataset(otJson, distributionKeyPair.privateKey);
            const distRootHash = ImportUtilities.calculateDatasetRootHash(encryptedDataset);
            encryptedDataset = ImportUtilities.encryptDataset(otJson, litigationKeyPair.privateKey);
            let sortedDataset =
                OtJsonUtilities.prepareDatasetForGeneratingLitigationProof(encryptedDataset);
            if (!sortedDataset) {
                sortedDataset = encryptedDataset;
            }
            this.challengeService = new ChallengeService();
            const litRootHash = this.challengeService.getLitigationRootHash(sortedDataset['@graph']);
            const distEpk = Encryption.packEPK(distributionKeyPair.publicKey);
            const distributionEpkChecksum =
                Encryption.calculateDataChecksum(distEpk, 0, 0, 0);

            const replication = {
                color,
                otJson: encryptedDataset,
                litigationPublicKey: litigationKeyPair.publicKey,
                litigationPrivateKey: litigationKeyPair.privateKey,
                distributionPublicKey: distributionKeyPair.publicKey,
                distributionPrivateKey: distributionKeyPair.privateKey,
                distributionEpkChecksum,
                litigationRootHash: litRootHash,
                distributionRootHash: distRootHash,
                distributionEpk: distEpk,
            };

            writeFilePromises.push(Utilities.writeContentsToFile(cacheDirectoryPath, `${color}.json`, JSON.stringify(replication)));


            hashes[`${color}LitigationHash`] = litRootHash;
            hashes[`${color}DistributionHash`] = distRootHash;
        }

        await Promise.all(writeFilePromises);
        process.send({ hashes });
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
