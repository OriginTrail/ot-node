const Migrations = artifacts.require('Migrations'); // eslint-disable-line no-undef

module.exports = (deployer, provider) => {
        console.log(`\t chosen DH indexes: ${JSON.stringify(provider)}`);
    deployer.deploy(Migrations);
};
