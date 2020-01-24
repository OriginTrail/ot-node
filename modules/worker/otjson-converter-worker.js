const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');

process.on('message', (data) => {
    try {
        const { standardId, config, dataset } = JSON.parse(data);
        let transpiler;
        switch (standardId) {
        case 'gs1': {
            transpiler = new EpcisOtJsonTranspiler({ config });
            break;
        }
        case 'wot': {
            transpiler = new WotOtJsonTranspiler({ config });
            break;
        }
        default:
            process.send({ error: `Unsupported standardId: ${standardId}` });
            return;
        }

        const stringifiedJson = transpiler.convertToOTJson(dataset);
        process.send(stringifiedJson);
    } catch (e) {
        process.send({ error: `${e.message}\n${e.stack}` });
    }
});
