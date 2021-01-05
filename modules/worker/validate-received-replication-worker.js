const fs = require('fs');
const { sha3_256 } = require('js-sha3');
const ImportUtilities = require('../ImportUtilities');
const OtJsonUtilities = require('../OtJsonUtilities');
const ChallengeService = require('../service/challenge-service');
const Utilities = require('../Utilities');

process.on('message', async (data) => {
    const {
        documentPath,
        litigationPublicKey,
        offerId,
        encColor,
        dataSetId,
        blockchainRootHash,
        litigationRootHash,
    } = JSON.parse(data);
    try {
        const { otJson, permissionedData }
            = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));
        const dataHash = Utilities.normalizeHex(sha3_256(`${otJson}`));
        const replication =
            await ImportUtilities.decryptDataset(otJson, litigationPublicKey, offerId, encColor);

        let { decryptedDataset } = replication;
        const { encryptedMap } = replication;

        const tempSortedDataset = OtJsonUtilities.prepareDatasetForNewReplication(decryptedDataset);
        if (tempSortedDataset) {
            decryptedDataset = tempSortedDataset;
        }
        const calculatedDataSetId =
            await ImportUtilities.calculateGraphPublicHash(decryptedDataset);

        if (dataSetId !== calculatedDataSetId) {
            throw new Error(`Calculated data set ID ${calculatedDataSetId} differs from DC data set ID ${dataSetId}`);
        }

        const decryptedGraphRootHash = ImportUtilities.calculateDatasetRootHash(decryptedDataset);

        if (decryptedGraphRootHash !== blockchainRootHash) {
            throw Error(`Calculated root hash ${decryptedGraphRootHash} differs from Blockchain root hash ${blockchainRootHash}`);
        }

        let sortedDataset =
            OtJsonUtilities.prepareDatasetForGeneratingLitigationProof(otJson);
        if (!sortedDataset) {
            sortedDataset = otJson;
        }
        this.challengeService = new ChallengeService();
        const encryptedGraphRootHash = this.challengeService.getLitigationRootHash(sortedDataset['@graph']);

        if (encryptedGraphRootHash !== litigationRootHash) {
            throw Error(`Calculated distribution hash ${encryptedGraphRootHash} differs from DC distribution hash ${litigationRootHash}`);
        }

        const originalRootHash = otJson.datasetHeader.dataIntegrity.proofs[0].proofValue;
        if (decryptedGraphRootHash !== originalRootHash) {
            throw Error(`Calculated root hash ${decryptedGraphRootHash} differs from document root hash ${originalRootHash}`);
        }
        process.send({
            dataHash, decryptedDataset, permissionedData, encryptedMap, decryptedGraphRootHash,
        });
    } catch (error) {
        process.send({ error: `${error.message}` });
    }
});
