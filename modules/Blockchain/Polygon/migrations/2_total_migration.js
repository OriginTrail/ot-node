var BN = require('bn.js');

var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef

var Hub = artifacts.require('Hub'); // eslint-disable-line no-undef
var Profile = artifacts.require('Profile'); // eslint-disable-line no-undef
var Holding = artifacts.require('Holding'); // eslint-disable-line no-undef
var CreditorHandler = artifacts.require('CreditorHandler'); // eslint-disable-line no-undef
var Litigation = artifacts.require('Litigation'); // eslint-disable-line no-undef
var Marketplace = artifacts.require('Marketplace'); // eslint-disable-line no-undef
var Replacement = artifacts.require('Replacement'); // eslint-disable-line no-undef
var Approval = artifacts.require('Approval'); // eslint-disable-line no-undef

var ProfileStorage = artifacts.require('ProfileStorage'); // eslint-disable-line no-undef
var HoldingStorage = artifacts.require('HoldingStorage'); // eslint-disable-line no-undef
var LitigationStorage = artifacts.require('LitigationStorage'); // eslint-disable-line no-undef
var MarketplaceStorage = artifacts.require('MarketplaceStorage'); // eslint-disable-line no-undef

const amountToMint = (new BN(5)).mul((new BN(10)).pow(new BN(30)));

module.exports = async (deployer, network, accounts) => {
    let hub;
    let token;

    let profile;
    let holding;
    let creditorHandler;
    let litigation;
    let marketplace;
    let replacement;
    let approval;

    let profileStorage;
    let holdingStorage;
    let litigationStorage;
    let marketplaceStorage;

    var amounts = [];
    var recepients = [];

    var temp;

    switch (network) {
    case 'development':
    case 'testnet':
        await deployer.deploy(Hub, { gas: 6000000, from: accounts[0] })
            .then((result) => {
                hub = result;
            });
        await hub.setContractAddress('Owner', accounts[0]);

        profileStorage = await deployer.deploy(
            ProfileStorage,
            hub.address, { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('ProfileStorage', profileStorage.address);

        holdingStorage = await deployer.deploy(
            HoldingStorage,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('HoldingStorage', holdingStorage.address);

        marketplaceStorage = await deployer.deploy(
            MarketplaceStorage,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('MarketplaceStorage', marketplaceStorage.address);

        litigationStorage = await deployer.deploy(
            LitigationStorage,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('LitigationStorage', litigationStorage.address);

        approval = await deployer.deploy(Approval);
        await hub.setContractAddress('Approval', approval.address);

        // todo check if the same account can be used
        token = await deployer.deploy(TracToken, accounts[0], accounts[0], accounts[0]);
        await hub.setContractAddress('Token', token.address);

        profile = await deployer.deploy(Profile, hub.address, { gas: 9000000, from: accounts[0] });
        await hub.setContractAddress('Profile', profile.address);

        holding = await deployer.deploy(Holding, hub.address, { gas: 8000000, from: accounts[0] });
        await hub.setContractAddress('Holding', holding.address);

        creditorHandler = await deployer.deploy(
            CreditorHandler,
            hub.address,
            { gas: 7000000, from: accounts[0] },
        );
        await hub.setContractAddress('CreditorHandler', creditorHandler.address);

        litigation = await deployer.deploy(
            Litigation,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('Litigation', litigation.address);

        marketplace = await deployer.deploy(
            Marketplace,
            hub.address,
            { gas: 7000000, from: accounts[0] },
        );
        await hub.setContractAddress('Marketplace', marketplace.address);

        replacement = await deployer.deploy(
            Replacement,
            hub.address,
            { gas: 7000000, from: accounts[0] },
        );
        await hub.setContractAddress('Replacement', replacement.address);

        // todo minting to one account
        for (let i = 0; i < 20; i += 1) {
            amounts.push(amountToMint);
            recepients.push(accounts[0]);
        }
        await token.mintMany(recepients, amounts, { from: accounts[0] });
        await token.finishMinting({ from: accounts[0] });

        console.log('\n\n \t Contract adressess on ganache:');
        console.log(`\t Hub contract address: \t\t\t${hub.address}`);
        console.log(`\t Approval contract address: \t\t${approval.address}`);
        console.log(`\t Token contract address: \t\t${token.address}`);
        console.log(`\t Profile contract address: \t\t${profile.address}`);
        console.log(`\t Holding contract address: \t\t${holding.address}`);
        console.log(`\t Litigation contract address: \t\t${litigation.address}`);
        console.log(`\t Marketplace contract address: \t\t${marketplace.address}`);
        console.log(`\t Replacement contract address: \t\t${replacement.address}`);

        console.log(`\t ProfileStorage contract address: \t${profileStorage.address}`);
        console.log(`\t HoldingStorage contract address: \t${holdingStorage.address}`);
        console.log(`\t LitigationStorage contract address: \t${litigationStorage.address}`);
        console.log(`\t MarketplaceStorage contract address: \t${marketplaceStorage.address}`);

        break;
    case 'updateContract':
        console.log(`Using wallet address: ${accounts[0]}`);
        hub = await Hub.at('0x819deeadF9c4a1d5199435Fa195ff7824CCd687e');
        console.log(`Using  hub  contract: ${hub.address}`);
        if (hub.address) {
            temp = await hub.getContractAddress.call('Owner');
            console.log(`\tOwner address in contract map: ${temp}`);

            temp = await hub.owner.call();
            console.log(`\tOwner address in contract var: ${temp}`);

            // Deploy contract
            holding = await deployer
                .deploy(Holding, hub.address, { gas: 7000000, from: accounts[0] });
            console.log(`Deployed new contract to address: ${holding.address}`);

            console.log('Updating contract in Hub contract map');
            await hub.setContractAddress('Holding', holding.address);
            console.log('Updated contract in Hub contract map!');
        }
        break;
    case 'mainnet':
        const tokenContractAddress = '0x4287F07CBE6954f9F0DecD91d0705C926d8d03A4';

        await deployer.deploy(Hub, { gas: 6000000, from: accounts[0] })
            .then((result) => {
                hub = result;
            });

        await hub.setContractAddress('Owner', accounts[0]);

        profileStorage = await deployer.deploy(
            ProfileStorage,
            hub.address, { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('ProfileStorage', profileStorage.address);

        holdingStorage = await deployer.deploy(
            HoldingStorage,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('HoldingStorage', holdingStorage.address);

        marketplaceStorage = await deployer.deploy(
            MarketplaceStorage,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('MarketplaceStorage', marketplaceStorage.address);

        litigationStorage = await deployer.deploy(
            LitigationStorage,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('LitigationStorage', litigationStorage.address);

        approval = await deployer.deploy(Approval);
        await hub.setContractAddress('Approval', approval.address);

        await hub.setContractAddress('Token', tokenContractAddress);

        profile = await deployer.deploy(Profile, hub.address, { gas: 9000000, from: accounts[0] });
        await hub.setContractAddress('Profile', profile.address);

        holding = await deployer.deploy(Holding, hub.address, { gas: 8000000, from: accounts[0] });
        await hub.setContractAddress('Holding', holding.address);

        creditorHandler = await deployer.deploy(
            CreditorHandler,
            hub.address,
            { gas: 7000000, from: accounts[0] },
        );
        await hub.setContractAddress('CreditorHandler', creditorHandler.address);

        litigation = await deployer.deploy(
            Litigation,
            hub.address,
            { gas: 6000000, from: accounts[0] },
        );
        await hub.setContractAddress('Litigation', litigation.address);

        marketplace = await deployer.deploy(
            Marketplace,
            hub.address,
            { gas: 7000000, from: accounts[0] },
        );
        await hub.setContractAddress('Marketplace', marketplace.address);

        replacement = await deployer.deploy(
            Replacement,
            hub.address,
            { gas: 7000000, from: accounts[0] },
        );
        await hub.setContractAddress('Replacement', replacement.address);


        console.log('\n\n \t Contract adressess on polygon mainnet:');
        console.log(`\t Hub contract address: \t\t\t${hub.address}`);
        console.log(`\t Approval contract address: \t\t${approval.address}`);
        console.log(`\t Token contract address: \t\t${tokenContractAddress}`);
        console.log(`\t Profile contract address: \t\t${profile.address}`);
        console.log(`\t Holding contract address: \t\t${holding.address}`);
        console.log(`\t Litigation contract address: \t\t${litigation.address}`);
        console.log(`\t Marketplace contract address: \t\t${marketplace.address}`);
        console.log(`\t Replacement contract address: \t\t${replacement.address}`);

        console.log(`\t ProfileStorage contract address: \t${profileStorage.address}`);
        console.log(`\t HoldingStorage contract address: \t${holdingStorage.address}`);
        console.log(`\t LitigationStorage contract address: \t${litigationStorage.address}`);
        console.log(`\t MarketplaceStorage contract address: \t${marketplaceStorage.address}`);

        break;
    default:
        console.warn('Please use one of the following network identifiers: ganache, mock, test, or rinkeby');
        break;
    }
};
