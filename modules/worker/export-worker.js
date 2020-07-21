const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');
const path = require('path');
const Utilities = require('../Utilities');
const ImportUtilities = require('../ImportUtilities');
const OtJsonUtilities = require('../OtJsonUtilities');
const fs = require('fs');
const Web3 = require('web3');

process.on('message', async (data) => {
    const {
        datasetId, standardId, handlerId, config,
    } = JSON.parse(data);

    const cacheDirectory = path.join(config.appDataPath, 'export_cache');
    const documentPath = path.join(cacheDirectory, handlerId);

    let document = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));

    try {
        if (!document['@id']) {
            const {
                vertices,
                edges,
                metadata,
            } = document;

            document = {
                '@id': datasetId,
                '@type': 'Dataset',
                '@graph': await ImportUtilities.createDocumentGraph(vertices, edges),
            };

            document.datasetHeader = metadata.datasetHeader;
            document.signature = metadata.signature;

            const sortedDataset = OtJsonUtilities.prepareDatasetForNewExport(document);
            if (sortedDataset) {
                document = sortedDataset;
            }
        }

        const web3 = new Web3(new Web3.providers.HttpProvider(config.blockchain.rpc_server_url));

        const dc_node_wallet = ImportUtilities.extractDatasetSigner(document, web3);
        const data_creator = document.datasetHeader.dataCreator;

        let dataset;
        switch (standardId) {
        case 'gs1': {
            const transpiler = new EpcisOtJsonTranspiler({ config });
            dataset = transpiler.convertFromOTJson(document);
            break;
        }
        case 'wot': {
            const transpiler = new WotOtJsonTranspiler({ config });
            dataset = JSON.stringify(transpiler.convertFromOTJson(document));
            break;
        }
        case 'ot-json': {
            let sortedDataset = OtJsonUtilities.prepareDatasetForOldExport(document);
            if (!sortedDataset) {
                sortedDataset = document;
            }
            dataset = JSON.stringify(sortedDataset);
            break;
        }
        default:
            throw new Error('Export for unsupported standard');
        }

        const cacheDirectory = path.join(config.appDataPath, 'export_cache');

        try {
            await Utilities.writeContentsToFile(
                cacheDirectory,
                handlerId,
                JSON.stringify({ formatted_dataset: dataset, dc_node_wallet, data_creator }),
            );
        } catch (e) {
            const filePath = path.join(cacheDirectory, handlerId);

            if (fs.existsSync(filePath)) {
                await Utilities.deleteDirectory(filePath);
            }
            throw new Error(`Error when creating export cache file for handler_id ${handlerId}. ${e.message}`);
        }
        process.send({ status: 'COMPLETED' });
    } catch (error) {
        const filePath = path.join(cacheDirectory, handlerId);
        if (fs.existsSync(filePath)) {
            await Utilities.deleteDirectory(filePath);
        }
        process.send({ error: `${error.message}` });
    }
});
