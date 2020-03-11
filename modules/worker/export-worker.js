const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');

process.on('message', (data) => {
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
    // if (result.error != null) {
    //     await processExport(result.error, data);
    // } else {
    //     switch (data.standard) {
    //         case 'gs1': {
    //             const formatted_dataset =
    //                 this.epcisOtJsonTranspiler.convertFromOTJson(result);
    //             await processExport(
    //                 null,
    //                 { formatted_dataset, handler_id: data.handler_id },
    //             );
    //             break;
    //         }
    //         case 'wot': {
    //             const formatted_dataset =
    //                 this.wotOtJsonTranspiler.convertFromOTJson(result);
    //             await processExport(
    //                 null,
    //                 { formatted_dataset, handler_id: data.handler_id },
    //             );
    //             break;
    //         }
    //         case 'ot-json': {
    //             await processExport(
    //                 null,
    //                 { formatted_dataset: result, handler_id: data.handler_id },
    //             );
    //             break;
    //         }
    //         default:
    //             throw new Error('Export for unsuported standard');
    //     }
    // }
});
