export async function executeContractFunction(
    web3,
    contractInstance,
    functionName,
    args,
    publicKey,
    privateKey,
) {
    const gas = await contractInstance.methods[functionName](...args).estimateGas({
        from: publicKey,
    });
    const encodedABI = contractInstance.methods[functionName](...args).encodeABI();
    const tx = {
        from: publicKey,
        to: contractInstance.options.address,
        data: encodedABI,
        gasPrice: 20,
        gas,
    };

    const createdTransaction = await web3.eth.accounts.signTransaction(tx, privateKey);
    await web3.eth.sendSignedTransaction(createdTransaction.rawTransaction);
}

export async function callContractFunction(contractInstance, functionName, args) {
    return contractInstance.methods[functionName](...args).call();
}

export function validateArguments(received, expected) {
    console.log(received);
    console.log(expected);
    for (const arg in expected) {
        if (!received[arg]) {
            return false;
        }
    }
    return true;
}
