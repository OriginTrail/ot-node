var EscrowHolder = artifacts.require("./EscrowHolder.sol");
var TestingUtilities = artifacts.require("./TestingUtilities.sol");
var TracToken = artifacts.require("./TracToken.sol");

module.exports = async function(deployer, network, accounts) {
	deployer.deploy(TestingUtilities);
	await deployer.deploy(TracToken, accounts[0], accounts[0], accounts[0]);

	let trac = await TracToken.deployed().then(async function(result){
		console.log("\t Trace address : " + result.address);
		await deployer.deploy(EscrowHolder, result.address)
	});        
	await EscrowHolder.deployed();
};
