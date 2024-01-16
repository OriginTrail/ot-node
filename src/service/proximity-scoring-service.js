import { xor as uint8ArrayXor } from 'uint8arrays/xor';
import { HASH_RING_SIZE, UINT128_MAX_BN } from '../constants/constants.js';

class ProximityScoringService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.proximityScoreFunctionsPairs = {
            1: [this.calculateBinaryXOR.bind(this), this.Log2PLDSF.bind(this)],
            2: [this.calculateProximityOnHashRing.bind(this), this.LinearLogisticSum.bind(this)],
        };
    }

    async callProximityFunction(
        blockchain,
        proximityFunctionId,
        peerHash,
        keyHash,
        ...additionalArgs
    ) {
        return this.proximityScoreFunctionsPairs[proximityFunctionId][0](
            blockchain,
            peerHash,
            keyHash,
            ...additionalArgs,
        );
    }

    async callScoreFunction(blockchain, scoreFunctionId, distance, stake, ...additionalArgs) {
        return this.proximityScoreFunctionsPairs[scoreFunctionId][1](
            blockchain,
            distance,
            stake,
            ...additionalArgs,
        );
    }

    async calculateBinaryXOR(blockchain, peerHash, keyHash) {
        const distance = uint8ArrayXor(
            this.blockchainModuleManager.convertBytesToUint8Array(blockchain, peerHash),
            this.blockchainModuleManager.convertBytesToUint8Array(blockchain, keyHash),
        );

        const distanceHex = await this.blockchainModuleManager.convertUint8ArrayToHex(
            blockchain,
            distance,
        );

        return this.blockchainModuleManager.toBigNumber(blockchain, distanceHex);
    }

    async calculateProximityOnHashRing(blockchain, peerHash, keyHash) {
        const peerPositionOnHashRing = await this.blockchainModuleManager.toBigNumber(
            blockchain,
            peerHash,
        );
        const keyPositionOnHashRing = await this.blockchainModuleManager.toBigNumber(
            blockchain,
            keyHash,
        );

        let directDistance = peerPositionOnHashRing.sub(keyPositionOnHashRing);

        if (directDistance.lt(0)) {
            directDistance = directDistance.add(HASH_RING_SIZE);
        }

        const wraparoundDistance = HASH_RING_SIZE.sub(directDistance);

        return directDistance.lt(wraparoundDistance) ? directDistance : wraparoundDistance;
    }

    async Log2PLDSF(blockchain, distance, stake) {
        const log2PLDSFParams = await this.blockchainModuleManager.getLog2PLDSFParams(blockchain);

        const {
            distanceMappingCoefficient,
            stakeMappingCoefficient,
            multiplier,
            logArgumentConstant,
            a,
            stakeExponent,
            b,
            c,
            distanceExponent,
            d,
        } = log2PLDSFParams;

        const mappedStake = this.blockchainModuleManager
            .toBigNumber(blockchain, this.blockchainModuleManager.convertToWei(blockchain, stake))
            .div(stakeMappingCoefficient);

        const mappedDistance = distance.div(distanceMappingCoefficient);

        const dividend = mappedStake.pow(stakeExponent).mul(a).add(b);
        const divisor = mappedDistance.pow(distanceExponent).mul(c).add(d);

        return Math.floor(
            Number(multiplier) *
                Math.log2(Number(logArgumentConstant) + dividend.toNumber() / divisor.toNumber()),
        );
    }

    // Using Maclaurin Series to approximate e^x
    _approximateExp(x, precision = 20) {
        let xPow = x;
        let factorial = 1;
        let result = 1;

        for (let i = 1; i <= precision; i += 1) {
            factorial *= i;
            result += xPow / factorial;
            xPow *= x;
        }

        return result;
    }

    async LinearLogisticSum(blockchain, distance, stake, maxNeighborhoodDistance) {
        const linearLogisticSumParams =
            await this.blockchainModuleManager.getLinearLogisticSumParams(blockchain);
        const { distanceScaleFactor, exponentMultiplier, x0, w1, w2 } = linearLogisticSumParams;

        let dividend = distance;
        let divisor = maxNeighborhoodDistance;
        if (dividend.gt(UINT128_MAX_BN) || divisor.gt(UINT128_MAX_BN)) {
            dividend = dividend.div(distanceScaleFactor);
            divisor = divisor.div(distanceScaleFactor);
        }

        const divResult = dividend.mul(distanceScaleFactor).div(divisor);
        const mappedDistance =
            parseFloat(divResult.toString()) / parseFloat(distanceScaleFactor.toString());

        const exponentPart = exponentMultiplier * (stake - x0);
        const mappedStake = 2 / (1 + this._approximateExp(exponentPart)) - 1;

        const proximityScore = w1 * (1 - mappedDistance);
        const stakeScore = w2 * mappedStake;

        return proximityScore + stakeScore;
    }
}

export default ProximityScoringService;
