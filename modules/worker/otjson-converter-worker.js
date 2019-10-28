const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');

process.on('message', (data) => {
    data = JSON.parse(data);
    let stringifiedJson;
    if (data.standardId === 'gs1') {
        const transpiler = new EpcisOtJsonTranspiler({ config: data.config });
        stringifiedJson = transpiler.convertToOTJson(data.xml);
    } else {
        // throw error standard not supported
    }
    process.send(stringifiedJson);
});
