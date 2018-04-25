var EscrowHolder = artifacts.require('EscrowHolder'); // eslint-disable-line no-undef
var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef
var Bidding = artifacts.require('Bidding');

const giveMeTracToken = function giveMeTracToken() {
	const token = TracToken.deployed();
	return token;
};

const giveMeEscrowHolder = function giveMeEscrowHolder() {
	const escrow = EscrowHolder.deployed();
	return escrow;
};

const giveMeBidding = function giveMeBidding() {
	const bidding = Bidding.deployed();
	return bidding;
};

var token;
var escrow;
var bidding;

var DC_wallet;
var DH_wallet;

const amountToMint = 25e25;

module.exports = (deployer, network, accounts) => {
	switch(network){
		case "ganache":
		DC_wallet = accounts[0];
		DH_wallet = accounts[1];
		deployer.deploy(TestingUtilities);
		deployer.deploy(TracToken, accounts[0], accounts[1], accounts[2])
		.then(() => giveMeTracToken())
		.then( (result) => {
			token = result;
			deployer.deploy(EscrowHolder, result.address)
			.then(() => giveMeEscrowHolder())
			.then( (result) => {
				escrow = result;
				deployer.deploy(Bidding, token.address, result.address)
				.then( () => giveMeBidding())
				.then( (result) => {
					bidding = result;
					escrow.transferOwnership(bidding.address)
					.then( () => {
						token.mint(DC_wallet, amountToMint, { from: accounts[0] }).catch( e => console.log(e))
						.then( () => {
	    					token.mint(DH_wallet, amountToMint, { from: accounts[0] }).catch( e => console.log(e))
	    					.then( () => {
		    					token.finishMinting({ from: accounts[0] }).catch( e => console.log(e))
		    					.then( () => {
									console.log("\n\n \t Contract adressess on ganache:");
									console.log("\t Token contract address: \t" + token.address);
									console.log("\t Escrow contract address: \t" + escrow.address);
									console.log("\t Bidding contract address: \t" + bidding.address);
								});
		    				});
	    				});
					});
				});
			});
			
		});
		break;
		case "rinkeby":
			console.log("NEMOJ DA IDES OVOM ULICOM!!!");
		break;
	}


}