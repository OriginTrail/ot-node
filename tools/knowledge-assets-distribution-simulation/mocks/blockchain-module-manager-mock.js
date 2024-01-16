import { ethers } from 'ethers';

class BlockchainModuleManagerMock {
    convertBytesToUint8Array(blockchain, bytesLikeData) {
        return ethers.utils.arrayify(bytesLikeData);
    }

    convertUint8ArrayToHex(blockchain, uint8Array) {
        return ethers.utils.hexlify(uint8Array);
    }

    convertToWei(blockchain, value, fromUnit = 'ether') {
        return ethers.utils.parseUnits(value.toString(), fromUnit).toString();
    }

    toBigNumber(blockchain, value) {
        return ethers.BigNumber.from(value);
    }

    getLog2PLDSFParams(blockchain) {
        return {
            distanceMappingCoefficient:
                '115792089237316195423570985008687907853269984665640564039457584007913129639',
            stakeMappingCoefficient: `${Math.floor(5000000 / 200000)}000000000000000000`,
            multiplier: 10000,
            logArgumentConstant: 1,
            a: 1,
            stakeExponent: 1,
            b: 0,
            c: 1,
            distanceExponent: 2,
            d: 1,
        };
    }

    getLinearLogisticSumParams(blockchain) {
        return {
            distanceScaleFactor: '1000000000000000000',
            exponentMultiplier: -0.000001,
            x0: 50000,
            w1: 1,
            w2: 1,
        };
    }
}

export default BlockchainModuleManagerMock;
