var EscrowHolder = artifacts.require('EscrowHolder'); // eslint-disable-line no-undef
var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef
var OTFingerprintStore = artifacts.require('OTFingerprintStore'); // eslint-disable-line no-undef
var Bidding = artifacts.require('Bidding'); // eslint-disable-line no-undef


const giveMeTracToken = async function giveMeTracToken() {
    const token = TracToken.deployed();
    return token;
};

const giveMeEscrowHolder = async function giveMeEscrowHolder() {
    const escrow = EscrowHolder.deployed();
    return escrow;
};

const giveMeBidding = function giveMeBidding() {
    const bidding = Bidding.deployed();
    return bidding;
};

const giveMeFingerprint = function giveMeFingerprint() {
    const fingerprint = OTFingerprintStore.deployed();
    return fingerprint;
};
var token;
var escrow;
var bidding;
var fingerprint;

var DC_wallet;
var DH_wallet;

const amountToMint = 25e25;

module.exports = (deployer, network, accounts) => {
    switch (network) {
    case 'ganache':
        DC_wallet = accounts[0]; // eslint-disable-line prefer-destructuring
        DH_wallet = accounts[1]; // eslint-disable-line prefer-destructuring
        deployer.deploy(TestingUtilities);
        deployer.deploy(TracToken, accounts[0], accounts[1], accounts[2])
            .then(() => giveMeTracToken())
            .then(async (result) => {
                token = result;
                await deployer.deploy(EscrowHolder, token.address)
                    .then(() => giveMeEscrowHolder())
                    .then((result) => {
                        escrow = result;
                        deployer.deploy(Bidding, token.address, escrow.address)
                            .then(() => giveMeBidding())
                            .then(async (result) => {
                                bidding = result;
                                await deployer.deploy(OTFingerprintStore)
                                    .then(() => giveMeFingerprint())
                                    .then((result) => {
                                        fingerprint = result;
                                        escrow.transferOwnership(bidding.address)
                                            .then(() => {
                                                token.mint(DC_wallet, amountToMint, { from: accounts[0] }) // eslint-disable-line max-len
                                                    .then(() => {
                                                        token.mint(DH_wallet, amountToMint, { from: accounts[0] }) // eslint-disable-line max-len
                                                            .then(() => {
                                                                token.finishMinting({ from: accounts[0] }) // eslint-disable-line max-len
                                                                    .then(() => {
                                                                        console.log('\n\n \t Contract adressess on ganache:');
                                                                        console.log('\t OT-fingerprint address: \t' + fingerprint.address); // eslint-disable-line
                                                                        console.log('\t Token contract address: \t' + token.address); // eslint-disable-line
                                                                        console.log('\t Escrow contract address: \t' + escrow.address); // eslint-disable-line
                                                                        console.log('\t Bidding contract address: \t' + bidding.address); // eslint-disable-line
                                                                    });
                                                            });
                                                    });
                                            });
                                    });
                            });
                    });
            });
        break;
    // eslint-disable-next-line
    case 'rinkeby':
        const tokenAddress = '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882';
        const fingerprintAddress = '0x8126e8a02bcae11a631d4413b9bd4f01f14e045d';
        deployer.deploy(EscrowHolder, tokenAddress)
            .then(() => giveMeEscrowHolder())
            .then((result) => {
                escrow = result;
                deployer.deploy(Bidding, tokenAddress, result.address)
                    .then(() => giveMeBidding())
                    .then((result) => {
                        bidding = result;
                        escrow.transferOwnership(bidding.address)
                            .then(() => {
                                console.log('\n\n \t Contract adressess on rinkeby:');
                                console.log('\t OT-fingerprint address: \t' + fingerprintAddress + ' (not changed)'); // eslint-disable-line prefer-template
                                console.log('\t Token contract address: \t' + tokenAddress + ' (not changed)'); // eslint-disable-line prefer-template
                                console.log('\t Escrow contract address: \t' + escrow.address); // eslint-disable-line prefer-template
                                console.log('\t Bidding contract address: \t' + bidding.address); // eslint-disable-line prefer-template
                            });
                    });
            });
        break;
    default:
        console.log('Please use either rinkeby or ganache');
        break;
    }
};
