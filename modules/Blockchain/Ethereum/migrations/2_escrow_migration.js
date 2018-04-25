var EscrowHolder = artifacts.require('EscrowHolder'); // eslint-disable-line no-undef
var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef

const giveMeTracToken = function giveMeTracToken() {
    const token = TracToken.deployed();
    return token;
  };

module.exports = (deployer, network, accounts) => {
    deployer.deploy(TestingUtilities);
    deployer.deploy(TracToken, accounts[0], accounts[1], accounts[2]).then(() => giveMeTracToken()).then(
        (result) => deployer.deploy(EscrowHolder, result.address)
    );
    }