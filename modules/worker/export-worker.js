const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');

process.on('message', async (data) => {
    // try {
    //     const { standardId, config, dataset } = JSON.parse(data);
    //     let transpiler;
    //     switch (standardId) {
    //         case 'gs1': {
    //             transpiler = new EpcisOtJsonTranspiler({ config });
    //             break;
    //         }
    //         case 'wot': {
    //             transpiler = new WotOtJsonTranspiler({ config });
    //             break;
    //         }
    //         default:
    //             process.send({ error: `Unsupported standardId: ${standardId}` });
    //             return;
    //     }
    //
    //     const stringifiedJson = transpiler.convertToOTJson(dataset);
    //     process.send(stringifiedJson);
    // } catch (e) {
    //     process.send({ error: `${e.message}\n${e.stack}` });
    // }
    //
    // // todo get import form db
    // // todo depending on standard id call transpiler
    // // todo save to file
    //
    // const result = await this.importService.getImport(datasetId);
    //
    const {
        standardId, handlerId, config, importResult,
    } = JSON.parse(data);
    var transpiler;
    try {
        switch (standardId) {
        case 'gs1': {
            transpiler = new EpcisOtJsonTranspiler({ config });
            break;
        }
        case 'wot': {
            transpiler = new WotOtJsonTranspiler({ config });
            break;
        }
        case 'ot-json': {
            process.send({ formatted_dataset: importResult });
            return;
        }
        default:
            throw new Error('Export for unsupported standard');
        }

        const formatted_dataset = transpiler.convertFromOTJson(importResult);
        process.send('COMPLETED');
    } catch (error) {
        process.send({ error: `${error.message}\n${error.stack}` });
    }
});
