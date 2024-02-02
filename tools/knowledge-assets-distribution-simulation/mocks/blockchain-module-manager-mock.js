import { ethers } from 'ethers';

class BlockchainModuleManagerMock {
    convertBytesToUint8Array(blockchain, bytesLikeData) {
        return ethers.utils.arrayify(bytesLikeData);
    }

    convertUint8ArrayToHex(blockchain, uint8Array) {
        return ethers.utils.hexlify(uint8Array);
    }

    convertFromWei(value, toUnit = 'ether') {
        return ethers.utils.formatUnits(value, toUnit);
    }

    convertToWei(blockchain, value, fromUnit = 'ether') {
        return ethers.utils.parseUnits(value.toString(), fromUnit).toString();
    }

    toBigNumber(blockchain, value) {
        return ethers.BigNumber.from(value);
    }

    getMinimumStake(blockchain) {
        return 50000;
    }

    getMaximumStake(blockchain) {
        return 1000000;
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

    getLinearSumParams(blockchain) {
        return {
            distanceScaleFactor: ethers.BigNumber.from('1000000000000000000'),
            stakeScaleFactor: ethers.BigNumber.from('1000000000000000000'),
            w1: 1,
            w2: 1,
        };
    }
}

export default BlockchainModuleManagerMock;
