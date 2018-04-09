var EscrowHolder = artifacts.require('EscrowHolder'); // eslint-disable-line no-undef
var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
var TestTracToken = artifacts.require('TestTracToken'); // eslint-disable-line no-undef

function giveMeTestTracToken() {
    const token = TestTracToken.deployed();
    return token;
}

module.exports = (deployer, network, accounts) => {
    deployer.deploy(TestingUtilities);
    deployer.deploy(TestTracToken, accounts[0], accounts[1], accounts[2]).then(() =>
        giveMeTestTracToken()).then(result => deployer.deploy(EscrowHolder, result.address));
};
