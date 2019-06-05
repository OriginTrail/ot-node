/* eslint-disable max-len */
require('dotenv').config();
const {
    describe, before, it,
} = require('mocha');
const fs = require('fs');
const chai = require('chai');
const xml2js = require('xml-js');
const lodash = require('lodash');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const { assert, expect } = chai;
const path = require('path');
const rc = require('rc');
const Utilities = require('../../modules/Utilities');
const EpcisOtJsonTranspiler = require('../../modules/transpiler/epcis/epcis-otjson-transpiler');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

describe('GS1 Importer tests', () => {
    let transpiler;

    const directoryPath = path.join(__dirname, '../../importers/epcis_12_examples/');
    const inputXmlFiles = fs.readdirSync(directoryPath).map(file => path.join(__dirname, `../../importers/epcis_12_examples/${file}`));

    before('Init EPCIS transpiler', async () => {
        const config = rc(pjson.name, defaultConfig);
        transpiler = new EpcisOtJsonTranspiler({
            config,
        });
    });

    describe('Convert XMLs into OT-JSON and vice versa', () => {
        inputXmlFiles.forEach((test) => {
            it(
                `should correctly transpile ${path.basename(test)} into OT-JSON and back`,
                // eslint-disable-next-line no-loop-func
                async () => {
                    const xmlContents = await Utilities.fileContents(test);
                    const rawJson = xml2js.xml2js(xmlContents, {
                        compact: true,
                        spaces: 4,
                    });

                    const otJson = transpiler.convertToOTJson(xmlContents);
                    assert.isTrue(otJson !== null);

                    const xmlFromOtJson = transpiler.convertFromOTJson(otJson);
                    const rawJsonFromOtJson = xml2js.xml2js(xmlFromOtJson, {
                        compact: true,
                        spaces: 4,
                    });
                    assert.isTrue(lodash.isEqual(rawJson, rawJsonFromOtJson), `Converted XML for ${path.basename(test)} is not equal to the original one`);
                },
            );
        });
    });
});
