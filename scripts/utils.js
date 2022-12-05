import { ethers } from 'ethers';

export async function executeContractFunction(
    web3,
    contractInstance,
    functionName,
    args,
    publicKey,
    privateKey,
) {
    const gas = 1000000;
    const encodedABI = contractInstance.methods[functionName](...args).encodeABI();
    const tx = {
        from: publicKey,
        to: contractInstance.options.address,
        data: encodedABI,
        gasPrice: ethers.utils.parseUnits('20', 'gwei').toString(),
        gas,
    };

    const createdTransaction = await web3.eth.accounts.signTransaction(tx, privateKey);
    await web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
}

export async function callContractFunction(contractInstance, functionName, args) {
    return contractInstance.methods[functionName](...args).call();
}

export function validateArguments(received, expected) {
    for (const arg of expected) {
        if (!received[arg]) {
            return false;
        }
    }
    return true;
}
