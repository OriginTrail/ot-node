// eslint-disable-next-line no-undef
const Migrations = artifacts.require('./Migrations.sol');

module.exports = function (deployer) {
    deployer.deploy(Migrations);
};
