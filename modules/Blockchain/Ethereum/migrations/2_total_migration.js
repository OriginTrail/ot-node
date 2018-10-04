const BN = require('bn.js');

const TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef
const Reading = artifacts.require('Reading'); // eslint-disable-line no-undef
const MockHolding = artifacts.require('MockHolding'); // eslint-disable-line no-undef
const TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef

const amountToMint = (new BN(5)).mul((new BN(10)).pow(new BN(25)));

module.exports = async (deployer, network, accounts) => {
    let token;
    let holding;

    switch (network) {
    case 'mock':

        await deployer.deploy(TracToken, accounts[0], accounts[1], accounts[2])
            .then(result => token = result);
        holding = await deployer.deploy(MockHolding);
        var amounts = [];
        var recepients = [];
        for (var i = 0; i < 10; i += 1) {
            amounts.push(amountToMint);
            recepients.push(accounts[i]);
        }
        await token.mintMany(recepients, amounts, { from: accounts[0] });

        console.log('\n\n \t Contract adressess on ganache (mock versions):');
        console.log(`\t Token contract address: \t${token.address}`);
        console.log(`\t Escrow contract address: \t${holding.address}`);
        break;
    default:
        console.warn('Please use one of the following network identifiers: ganache, mock, test, or rinkeby');
        break;
    }
};
