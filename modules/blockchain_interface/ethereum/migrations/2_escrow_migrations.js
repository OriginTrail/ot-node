var EscrowHolder = artifacts.require('./EscrowHolder.sol'); // eslint-disable-line no-undef
var TestingUtilities = artifacts.require('./TestingUtilities.sol'); // eslint-disable-line no-undef
var TracToken = artifacts.require('./TracToken.sol'); // eslint-disable-line no-undef

module.exports = async function (deployer, network, accounts) {
    deployer.deploy(TestingUtilities);
    await deployer.deploy(TracToken, accounts[0], accounts[0], accounts[0]);

    const trac = await TracToken.deployed().then(async (result) => {
        console.log(`\t Trace address : ${result.address}`);
        await deployer.deploy(EscrowHolder, result.address);
    });
    await EscrowHolder.deployed();
};
