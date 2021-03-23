const {
    describe, before, beforeEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const awilix = require('awilix');

const DIDService = require('../../../modules/service/did-service');

const sampleDID = 'did:ethr:0x123123123123123123';
const sampleValue = '0x123123123123123123123';

let didService;

describe('Permission data service test', () => {
    beforeEach('Setup container', async () => {
        // Create the container and set the injectionMode to PROXY (which is also the default).
        process.env.NODE_ENV = 'mainnet';
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        didService = new DIDService(container.cradle);
    });

    it('Should extract network ID from DID', () => {
        const { supportedNetworks } = didService;
        const networkId = didService.extractNetworkIDFromDID(sampleDID);

        assert(networkId != null);
        assert(typeof networkId === 'string');
        assert(supportedNetworks.indexOf(networkId) != null);
    });

    it('Should create a DID from a bare value', () => {
        const { supportedNetworks } = didService;
        const encodedDID = didService.encodeDID(sampleValue, supportedNetworks[0]);

        assert(encodedDID != null);
        assert(typeof encodedDID === 'string');
        assert(encodedDID.length === sampleValue.length + supportedNetworks[0].length);
        assert(encodedDID.indexOf(sampleValue) === supportedNetworks[0].length);
        assert(encodedDID.indexOf(supportedNetworks[0]) === 0);
    });
});
