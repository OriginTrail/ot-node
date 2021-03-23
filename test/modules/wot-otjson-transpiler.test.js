/* eslint-disable max-len */
require('dotenv').config();
const {
    describe, before, it,
} = require('mocha');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const { assert, expect } = chai;
const path = require('path');
const rc = require('rc');
const Web3 = require('web3');

const Utilities = require('../../modules/Utilities');

const WotOtJsonTranspiler = require('../../modules/transpiler/wot/wot-otjson-transpiler');

const defaultConfig = require('../../config/config.json').development;
const pjson = require('../../package.json');

describe('WOT OT JSON transpiler tests', () => {
    let transpiler;
    let blockchain;

    const inputJsonFile = path.join(__dirname, '../../importers/json_examples/kakaxi.wot');

    before('Init WOT transpiler', async () => {
        const config = rc(pjson.name, defaultConfig);

        blockchain = [{
            blockchain_id: 'ethr',
            hub_contract_address: '0x2B7ca432a13e0D035BC46F0d6bf3cde1E72A10E5',
            identity: '0x2Fa6d32E314AAB43a58999D6f5532A15418Da153',
            erc725Identity: '0x611d771aAfaa3D6Fb66c4a81D97768300a6882D5',
            node_wallet: '0xa9a07f3c53ec5de8dd83039ca27fae83408e16f5',
            node_private_key: '952e45854ca5470a6d0b6cb86346c0e9c4f8f3a5a459657df8c94265183b9253',
        }];

        const web3 = new Web3();
        transpiler = new WotOtJsonTranspiler({
            web3,
            config,
        });
    });
    describe('Convert WOT JSON into OT-JSON and vice versa', () => {
        it(
            'should correctly transpile file into OT-JSON and back',
            async () => {
                const jsonContents = await Utilities.fileContents(inputJsonFile);
                const otJson = transpiler.convertToOTJson(jsonContents, blockchain);
                assert.isNotNull(otJson, 'Transpilation result is null');

                const wotJsonFromOtJson = transpiler.convertFromOTJson(otJson);

                assert.deepEqual(
                    Utilities.sortedStringify(JSON.parse(jsonContents), true),
                    Utilities.sortedStringify(wotJsonFromOtJson, true),
                    'Converted WOT is not equal to the original one',
                );
            },
        );
    });
});
