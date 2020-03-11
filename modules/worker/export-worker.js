const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');
const path = require('path');
const Utilities = require('../Utilities');
const fs = require('fs');

process.on('message', async (data) => {
    const {
        standardId, handlerId, config, importResult,
    } = JSON.parse(data);
    var dataset;
    try {
        switch (standardId) {
        case 'gs1-epcis': {
            const transpiler = new EpcisOtJsonTranspiler({ config });
            dataset = transpiler.convertFromOTJson(importResult);
            break;
        }
        case 'wot': {
            const transpiler = new WotOtJsonTranspiler({ config });
            dataset = transpiler.convertFromOTJson(importResult);
            break;
        }
        case 'ot-json':
        case 'graph': {
            dataset = importResult;
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
                JSON.stringify(dataset),
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
