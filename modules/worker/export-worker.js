const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');
const path = require('path');
const Utilities = require('../Utilities');
const ImportUtilities = require('../ImportUtilities');
const fs = require('fs');

process.on('message', async (data) => {
    const {
        datasetId, standardId, handlerId, config, vertices,
        edges,
        metadata,
    } = JSON.parse(data);

    try {
        const document = {
            '@id': datasetId,
            '@type': 'Dataset',
            '@graph': await ImportUtilities.createDocumentGraph(vertices, edges),
        };

        document.datasetHeader = metadata.datasetHeader;
        document.signature = metadata.signature;

        const importResult = JSON.parse(ImportUtilities.sortStringifyDataset(document));
        var dataset;
        switch (standardId) {
        case 'gs1': {
            const transpiler = new EpcisOtJsonTranspiler({ config });
            dataset = transpiler.convertFromOTJson(importResult);
            break;
        }
        case 'wot': {
            const transpiler = new WotOtJsonTranspiler({ config });
            dataset = transpiler.convertFromOTJson(importResult);
            break;
        }
        case 'ot-json': {
            dataset = JSON.stringify(importResult);
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
                JSON.stringify({ formatted_dataset: dataset }),
            );
        } catch (e) {
            const filePath = path.join(cacheDirectory, handlerId);

            if (fs.existsSync(filePath)) {
                await Utilities.deleteDirectory(filePath);
            }
            throw new Error(`Error when creating export cache file for handler_id ${handlerId}. ${e.message}`);
        }
        process.send('COMPLETED');
    } catch (error) {
        process.send({ error: `${error.message}\n${error.stack}` });
    }
});
