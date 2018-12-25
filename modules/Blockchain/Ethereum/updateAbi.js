var BN = require('bn.js');
var fs = require('fs');

var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef

var Hub = artifacts.require('Hub'); // eslint-disable-line no-undef
var Profile = artifacts.require('Profile'); // eslint-disable-line no-undef
var Holding = artifacts.require('Holding'); // eslint-disable-line no-undef
var Litigation = artifacts.require('Litigation'); // eslint-disable-line no-undef
var Reading = artifacts.require('Reading'); // eslint-disable-line no-undef
var Approval = artifacts.require('Approval'); // eslint-disable-line no-undef

var ProfileStorage = artifacts.require('ProfileStorage'); // eslint-disable-line no-undef
var HoldingStorage = artifacts.require('HoldingStorage'); // eslint-disable-line no-undef
var LitigationStorage = artifacts.require('LitigationStorage'); // eslint-disable-line no-undef

var MockHolding = artifacts.require('MockHolding'); // eslint-disable-line no-undef
var MockLitigation = artifacts.require('MockLitigation'); // eslint-disable-line no-undef
var MockApproval = artifacts.require('MockApproval'); // eslint-disable-line no-undef
var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef


const amountToMint = (new BN(5)).mul((new BN(10)).pow(new BN(30)));

module.exports = async (callback) => {
    let hub;
    let token;

    let profile;
    let holding;
    let litigation;
    let reading;
    let approval;

    let profileStorage;
    let holdingStorage;
    let litigationStorage;

    var amounts = [];
    var recepients = [];

    const contractNames = [
        'Approval',
        'ERC725',
        'HoldingStorage',
        'Holding',
        'Hub',
        'LitigationStorage',
        'Litigation',
        'ProfileStorage',
        'Profile',
        'TracToken',
    ];

    const abis = [];

    var filepath;
    var file;

    console.log('ni ovo ne radi');
    console.log(contractNames.length);
    for (var i = 0; i < contractNames.length; i += 1) {
        console.log('ne radi');
        try {
            filepath = `./build/contracts/${contractNames[i]}.json`;
            file = fs.readFileSync(filepath, 'utf8');
            var data = JSON.parse(file);

            abis[i] = data.abi;
        } catch (e) {
            console.log(e);
            return;
        }

        console.log('ne radi');
    }

    filepath = './abi/approval.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[0], null, 4));

    filepath = './abi/erc725.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[1], null, 4));

    filepath = './abi/holding-storage.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[2], null, 4));

    filepath = './abi/holding.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[3], null, 4));

    filepath = './abi/hub.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[4], null, 4));

    filepath = './abi/litigation-storage.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[5], null, 4));

    filepath = './abi/litigation.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[6], null, 4));

    filepath = './abi/profile-storage.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[7], null, 4));

    filepath = './abi/profile.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[8], null, 4));

    filepath = './abi/token.json';
    fs.writeFileSync(filepath, JSON.stringify(abis[9], null, 4));
};
