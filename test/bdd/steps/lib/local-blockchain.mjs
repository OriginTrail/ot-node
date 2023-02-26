/* eslint-disable max-len */

import { ethers } from "ethers";
import {readFile} from "fs/promises";
import {exec} from "child_process";


const testParametersStorageParams = {
    epochLength: 6*60, // 6 minutes
    commitWindowDurationPerc: 33, // 2 minutes
    minProofWindowOffsetPerc: 66, // 4 minutes
    maxProofWindowOffsetPerc: 66, // 4 minutes
    proofWindowDurationPerc: 33, // 2 minutes
}
/**
 * LocalBlockchain represent small wrapper around the Ganache.
 *
 * LocalBlockchain uses the Ganache-core to run in-memory blockchain simulator. It uses
 * predefined accounts that can be fetch by calling LocalBlockchain.wallets(). Account with
 * index 7 is used for deploying contracts.
 *
 * Basic usage:
 * LocalBlockchain.wallets()[9].instance.address
 * LocalBlockchain.wallets()[9].privateKey,
 *
 * const localBlockchain = new LocalBlockchain({ logger: this.logger });
 * await localBlockchain.initialize(); // Init the server.
 * // That will compile and deploy contracts. Later can be called
 * // deployContracts() to re-deploy fresh contracts.
 *
 * // After usage:
 *     if (localBlockchain.server) {
 *         this.state.localBlockchain.server.close();
 *     }
 *
 * @param {String} [options.logger] - Logger instance with debug, trace, info and error methods.
 */
class LocalBlockchain {

    async initialize() {
        const startBlockchainProcess = exec('npm run start:local_blockchain', );
        startBlockchainProcess.stdout.on('data', function(data) {
            console.log(data);
        });
        console.log('Waiting for 3 seconds for blockchain to start and contracts to be deployed');
        await new Promise(resolve => setTimeout(resolve, 3000));

        this.provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

        const privateKeysFile = await readFile('test/bdd/steps/api/datasets/privateKeys.json');
        const publicKeysFile = await readFile('test/bdd/steps/api/datasets/publicKeys.json');
        const privateKeys = JSON.parse(privateKeysFile.toString());
        const publicKeys = JSON.parse(publicKeysFile.toString());

        this.wallets = privateKeys.map((privateKey, index) => ({
            address: publicKeys[index],
            privateKey,
        }));

    }

    fetchContracts() {
        this.contracts = {};
        for (const [name, source] of Object.entries(sources)) {
            this.populateContractObject(name, source);
        }
    }

    populateContractObject(contractName, source) {
        this.contracts[contractName] = {};
        this.contracts[contractName].data = source.bytecode;
        this.contracts[contractName].abi = source.abi;
    }

    async setParametersStorageParams(params) {
        for (const parameter of Object.keys(params)) {
            const blockchainMethodName = `set${parameter.charAt(0).toUpperCase() + parameter.slice(1)}`;
            this.logger.info(`Setting ${parameter} in parameters storage to: ${params[parameter]}`)
            // eslint-disable-next-line no-await-in-loop
            await this.contracts.parametersStorage.instance[blockchainMethodName](
                params[parameter],
                { gasLimit: 50000 },
            );
        }
    }

    async setR1(r1) {
        return this.contracts.parametersStorage.instance
            .setR1(r1, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(`Unable to set R1 in parameters storage. Error: `, error),
            );
    }

    async setR2(r2) {
        return this.contracts.parametersStorage.instance
            .setR2(r2, { gasLimit: 3000000 })
            .catch((error) =>
                this.logger.error(`Unable to set R2 in parameters storage. Error: `, error),
            );
    }

    async getContractAddress(hubContract, contractName) {
        return hubContract.getContractAddress(contractName);
    }

    async setupRole(contract, minter) {
        await contract.instance
            .setupRole(minter, { gasLimit: 3000000 })
            .catch((error) => this.logger.error('Unable to setup role. Error: ', error));
    }

    getWallets() {
        return wallets;
    }
}

export default LocalBlockchain;
