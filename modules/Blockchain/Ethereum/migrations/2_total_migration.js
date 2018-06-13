/* eslint indent: 0 */
var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef
var OTFingerprintStore = artifacts.require('OTFingerprintStore'); // eslint-disable-line no-undef

var EscrowHolder = artifacts.require('EscrowHolder'); // eslint-disable-line no-undef
var BiddingTest = artifacts.require('BiddingTest'); // eslint-disable-line no-undef
var Bidding = artifacts.require('Bidding'); // eslint-disable-line no-undef
var Reading = artifacts.require('Reading'); // eslint-disable-line no-undef

var MockEscrowHolder = artifacts.require('MockEscrowHolder'); // eslint-disable-line no-undef
var MockBidding = artifacts.require('MockBidding'); // eslint-disable-line no-undef
var MockReading = artifacts.require('MockReading'); // eslint-disable-line no-undef

var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef


const giveMeTracToken = async function giveMeTracToken() {
    const token = TracToken.deployed();
    return token;
};
const giveMeFingerprint = function giveMeFingerprint() {
    const fingerprint = OTFingerprintStore.deployed();
    return fingerprint;
};


const giveMeEscrowHolder = async function giveMeEscrowHolder() {
    const escrow = EscrowHolder.deployed();
    return escrow;
};
const giveMeBidding = async function giveMeBidding() {
    const bidding = Bidding.deployed();
    return bidding;
};
const giveMeBiddingTest = async function giveMeBiddingTest() {
    const bidding = BiddingTest.deployed();
    return bidding;
};
const giveMeReading = async function givemere() {
    const reading = Reading.deployed();
    return reading;
};


const giveMeMockEscrowHolder = async function giveMeMockEscrowHolder() {
    const escrow = MockEscrowHolder.deployed();
    return escrow;
};
const giveMeMockBidding = async function giveMeMockBidding() {
    const bidding = MockBidding.deployed();
    return bidding;
};
const giveMeMockReading = async function giveMeMockReading() {
    const reading = MockReading.deployed();
    return reading;
};

var token;
var escrow;
var bidding;
var fingerprint;
var reading;

var DC_wallet;
var DH_wallet;

const amountToMint = 5e25;

module.exports = (deployer, network, accounts) => {
    switch (network) {
    case 'ganache':
        DC_wallet = accounts[0]; // eslint-disable-line prefer-destructuring
        DH_wallet = accounts[1]; // eslint-disable-line prefer-destructuring
        deployer.deploy(TracToken, accounts[0], accounts[1], accounts[2])
            .then(() => giveMeTracToken())
            .then(async (result) => {
            token = result;
            await deployer.deploy(EscrowHolder, token.address, { gas: 8000000, from: accounts[0] })
            .then(() => giveMeEscrowHolder())
            .then(async (result) => {
            escrow = result;
            await deployer.deploy(Reading, escrow.address, { gas: 8000000, from: accounts[0] })
            .then(() => giveMeReading())
            .then(async (result) => {
            reading = result;
            await deployer.deploy(BiddingTest, token.address, escrow.address, reading.address)
            .then(() => giveMeBiddingTest())
            .then(async (result) => {
            bidding = result;
            await deployer.deploy(OTFingerprintStore)
            .then(() => giveMeFingerprint())
            .then(async (result) => {
            fingerprint = result;
            await escrow.setBidding(bidding.address, { from: accounts[0] })
            .then(async () => {
            await escrow.setReading(reading.address, { from: accounts[0] })
            .then(async () => {
            await reading.setBidding(bidding.address, { from: accounts[0] })
            .then(async () => {
            await reading.transferOwnership(escrow.address, { from: accounts[0] })
            .then(async () => {
            await escrow.transferOwnership(bidding.address, { from: accounts[0] })
            .then(async () => {
            var amounts = [];
            var recepients = [];
            for (let i = 0; i < 10; i += 1) {
                amounts.push(amountToMint);
                recepients.push(accounts[i]);
            }
            await token.mintMany(recepients, amounts, { from: accounts[0] })
            .then(async () => {
            await token.finishMinting({ from: accounts[0] })
            .then(() => {
                console.log('\n\n \t Contract adressess on ganache:');
                console.log(`\t OT-fingerprint contract address: \t ${fingerprint.address}`); // eslint-disable-line
                console.log(`\t Token contract address: \t ${token.address}`); // eslint-disable-line
                console.log(`\t Escrow contract address: \t ${escrow.address}`); // eslint-disable-line
                console.log(`\t Bidding contract address: \t ${bidding.address}`); // eslint-disable-line
                console.log(`\t Reading contract address: \t ${reading.address}`); // eslint-disable-line
            });
            });
            });
            });
            });
            });
            });
            });
            });
            });
            });
            });
        break;
    case 'test':
        deployer.deploy(TracToken, accounts[0], accounts[1], accounts[2])
            .then(() => giveMeTracToken())
            .then(async (result) => {
                token = result;
                await deployer.deploy(EscrowHolder, token.address, { gas: 8000000, from: accounts[0] })
                    .then(() => giveMeEscrowHolder())
                    .then(async (result) => {
                        escrow = result;
                        await deployer.deploy(Reading, escrow.address, { gas: 8000000, from: accounts[0] })
                            .then(() => giveMeReading())
                            .then(async (result) => {
                                reading = result;
                                await deployer.deploy(BiddingTest, token.address, escrow.address, reading.address)
                                    .then(() => giveMeBiddingTest())
                                    .then(async (result) => {
                                        bidding = result;
                                        await deployer.deploy(TestingUtilities)
                                            .then(async () => {
                                                await escrow.setBidding(bidding.address, { from: accounts[0] })
                                                    .then(async () => {
                                                        await escrow.setReading(reading.address, { from: accounts[0] })
                                                            .then(async () => {
                                                                await reading.setBidding(bidding.address, { from: accounts[0] })
                                                                    .then(async () => {
                                                                        await reading.transferOwnership(escrow.address, { from: accounts[0] })
                                                                            .then(async () => {
                                                                                await escrow.transferOwnership(bidding.address, { from: accounts[0] })
                                                                                    .then(async () => {
                                                                                        var amounts = [];
                                                                                        var recepients = [];
                                                                                        for (let i = 0; i < 10; i += 1) {
                                                                                            amounts.push(amountToMint);
                                                                                            recepients.push(accounts[i]);
                                                                                        }
                                                                                        await token.mintMany(recepients, amounts, { from: accounts[0] })
                                                                                            .then(async () => {
                                                                                                await token.finishMinting({ from: accounts[0] })
                                                                                                    .then(() => {
                                                                                                        console.log('\n\n \t Contract adressess on ganache (for testing):');
                                                                                                        console.log(`\t Token contract address: \t ${token.address}`);
                                                                                                        console.log(`\t Escrow contract address: \t ${escrow.address}`);
                                                                                                        console.log(`\t Bidding contract address: \t ${bidding.address}`);
                                                                                                        console.log(`\t Reading contract address: \t ${reading.address}`);
                                                                                                    });
                                                                                            });
                                                                                    });
                                                                            });
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
                                console.log(`\t OT-fingerprint address: \t${fingerprintAddress} (not changed)`);
                                console.log(`\t Token contract address: \t${fingerprintAddress} (not changed)`);
                                console.log(`\t Escrow contract address: \t ${escrow.address}`);
                                console.log(`\t Bidding contract address: \t ${bidding.address}`);
                            });
                    });
            });
        break;
    case 'mock':
        DC_wallet = accounts[0]; // eslint-disable-line prefer-destructuring
        DH_wallet = accounts[1]; // eslint-disable-line prefer-destructuring
        deployer.deploy(TracToken, accounts[0], accounts[1], accounts[2])
            .then(() => giveMeTracToken())
            .then(async (result) => {
                token = result;
                await deployer.deploy(MockEscrowHolder, token.address)
                    .then(() => giveMeMockEscrowHolder())
                    .then(async (result) => {
                        escrow = result;
                        await deployer.deploy(MockReading, escrow.address)
                            .then(() => giveMeMockReading())
                            .then(async (result) => {
                                reading = result;
                                await deployer.deploy(MockBidding, token.address, escrow.address, reading.address)
                                    .then(() => giveMeMockBidding())
                                    .then(async (result) => {
                                        bidding = result;
                                        await deployer.deploy(OTFingerprintStore)
                                            .then(() => giveMeFingerprint())
                                            .then(async (result) => {
                                                fingerprint = result;
                                                await escrow.transferOwnership(bidding.address)
                                                    .then(async () => {
                                                        var amounts = [];
                                                        var recepients = [];
                                                        for (var i = 0; i < 10; i += 1) {
                                                            amounts.push(amountToMint);
                                                            recepients.push(accounts[i]);
                                                        }
                                                        await token.mintMany(recepients, amounts, { from: accounts[0] })
                                                            .then(async () => {
                                                                await token.finishMinting({ from: accounts[0] })
                                                                    .then(() => {
                                                                        console.log('\n\n \t Contract adressess on ganache (mock versions):');
                                                                        console.log('\t OT-fingerprint address: \t' + fingerprint.address); // eslint-disable-line
                                                                        console.log('\t Token contract address: \t' + token.address); // eslint-disable-line
                                                                        console.log('\t Escrow contract address: \t' + escrow.address); // eslint-disable-line
                                                                        console.log('\t Bidding contract address: \t' + bidding.address); // eslint-disable-line
                                                                        console.log('\t Reading contract address: \t' + reading.address); // eslint-disable-line
                                                                    });
                                                            });
                                                    });
                                            });
                                    });
                            });
                    });
            });
        break;
    default:
        console.warn('Please use one of the following network identifiers: ganache, mock, test, or rinkeby');
        break;
    }
};
