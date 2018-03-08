// eslint-disable-next-line no-undef
var Migrations = artifacts.require('./Migrations.sol');

module.exports = function (deployer) {
	deployer.deploy(Migrations);
};
