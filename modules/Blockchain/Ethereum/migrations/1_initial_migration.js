const Migrations = artifacts.require('Migrations'); // eslint-disable-line no-undef

module.exports = (deployer, provider) => {
    deployer.deploy(Migrations);
};
