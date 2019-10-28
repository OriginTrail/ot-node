const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');

process.on('message', (data) => {
    data = JSON.parse(data);
    let stringifiedJson;
    switch (data.standardId) {
    case 'gs1': {
        const transpiler = new EpcisOtJsonTranspiler({ config: data.config });
        stringifiedJson = transpiler.convertToOTJson(data.dataset);
        break;
    }
    case 'wot': {
        const transpiler = new WotOtJsonTranspiler({ config: data.config });
        stringifiedJson = transpiler.convertToOTJson(data.dataset);
        break;
    }
    default:
        process.send({ error: `Unsupported standardId: ${data.standardId}` });
        return;
    }
    process.send(stringifiedJson);
});
