const EpcisOtJsonTranspiler = require('.././transpiler/epcis/epcis-otjson-transpiler');

process.on('message', (data) => {
    data = JSON.parse(data);
    const transpiler = new EpcisOtJsonTranspiler({ config: data.config });
    const stringifiedJson = transpiler.convertToOTJson(data.xml);
    process.send(stringifiedJson);
});
