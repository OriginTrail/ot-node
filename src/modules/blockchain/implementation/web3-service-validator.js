class Web3ServiceValidator {
    static validateResult(functionName, contractName, result, logger) {
        if (Web3ServiceValidator[`${functionName}Validator`]) {
            logger.trace(
                `Calling web3 service validator for function name: ${functionName}, contract: ${contractName}`,
            );
            return Web3ServiceValidator[`${functionName}Validator`](result);
        }
        return true;
    }
}

export default Web3ServiceValidator;
