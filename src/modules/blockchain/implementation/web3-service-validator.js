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

    static getAgreementDataValidator(result) {
        if (!result) {
            return false;
        }
        const agreementData = {
            startTime: result['0'].toNumber(),
            epochsNumber: result['1'],
            epochLength: result['2'].toNumber(),
            scoreFunctionId: result['4'][0],
            proofWindowOffsetPerc: result['4'][1],
        };
        return !(
            agreementData.startTime === 0 &&
            agreementData.epochsNumber === 0 &&
            agreementData.epochLength === 0 &&
            agreementData.scoreFunctionId === 0 &&
            agreementData.proofWindowOffsetPerc === 0
        );
    }
}

export default Web3ServiceValidator;
