const fs = require('fs');

const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');
const WotOtJsonTranspiler = require('.././transpiler/wot/wot-otjson-transpiler');

process.on('message', (data) => {
    try {
        data = JSON.parse(data);
        let transpiler;
        switch (data.standardId) {
        case 'gs1': {
            transpiler = new EpcisOtJsonTranspiler({ config: data.config });
            break;
        }
        case 'wot': {
            transpiler = new WotOtJsonTranspiler({ config: data.config });
            break;
        }
        default:
            process.send({ error: `Unsupported standardId: ${data.standardId}` });
            return;
        }

        const dataset = fs.readFileSync(data.documentPath);
        const stringifiedJson = transpiler.convertToOTJson(dataset);
        // TODO Save to file, don't send via process
        process.send(stringifiedJson);
    } catch (e) {
        process.send({ error: e.message });
    }
});
