import { xor as uint8ArrayXor } from 'uint8arrays/xor';
import {
    HASH_RING_SIZE,
    UINT40_MAX_BN,
    UINT64_MAX_BN,
    UINT256_MAX_BN,
} from '../constants/constants.js';

class ProximityScoringService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.proximityScoreFunctionsPairs = {
            1: [this.calculateBinaryXOR.bind(this), this.log2PLDSF.bind(this)],
            2: [
                this.calculateBidirectionalProximityOnHashRing.bind(this),
                this.linearSum.bind(this),
            ],
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

    async calculateBidirectionalProximityOnHashRing(blockchain, peerHash, keyHash) {
        const peerPositionOnHashRing = await this.blockchainModuleManager.toBigNumber(
            blockchain,
            peerHash,
        );
        const keyPositionOnHashRing = await this.blockchainModuleManager.toBigNumber(
            blockchain,
            keyHash,
        );

        const directDistance = peerPositionOnHashRing.gt(keyPositionOnHashRing)
            ? peerPositionOnHashRing.sub(keyPositionOnHashRing)
            : keyPositionOnHashRing.sub(peerPositionOnHashRing);
        const wraparoundDistance = HASH_RING_SIZE.sub(directDistance);

        return directDistance.lt(wraparoundDistance) ? directDistance : wraparoundDistance;
    }

    async log2PLDSF(blockchain, distance, stake) {
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

    async linearSum(
        blockchain,
        distance,
        stake,
        maxNeighborhoodDistance,
        r2,
        nodesNumber,
        minStake,
        maxStake,
        returnIntermediateValues = false,
    ) {
        const linearSumParams = await this.blockchainModuleManager.getLinearSumParams(blockchain);
        const { distanceScaleFactor, stakeScaleFactor, w1, w2 } = linearSumParams;
        const mappedStake = this.blockchainModuleManager.toBigNumber(
            blockchain,
            this.blockchainModuleManager.convertToWei(blockchain, stake),
        );
        const mappedMinStake = this.blockchainModuleManager.toBigNumber(
            blockchain,
            this.blockchainModuleManager.convertToWei(blockchain, minStake),
        );
        const mappedMaxStake = this.blockchainModuleManager.toBigNumber(
            blockchain,
            this.blockchainModuleManager.convertToWei(blockchain, maxStake),
        );

        const idealMaxDistanceInNeighborhood = HASH_RING_SIZE.div(nodesNumber).mul(
            Math.ceil(r2 / 2),
        );
        const divisor = maxNeighborhoodDistance.lte(idealMaxDistanceInNeighborhood)
            ? maxNeighborhoodDistance
            : idealMaxDistanceInNeighborhood;

        const maxMultiplier = UINT256_MAX_BN.div(distance);

        let scaledDistanceScaleFactor = distanceScaleFactor;
        let compensationFactor = 1;

        if (scaledDistanceScaleFactor.gt(maxMultiplier)) {
            compensationFactor = scaledDistanceScaleFactor.div(maxMultiplier);
            scaledDistanceScaleFactor = maxMultiplier;
        }

        const scaledDistance = distance.mul(scaledDistanceScaleFactor);
        const adjustedDivisor = divisor.div(compensationFactor);

        const normalizedDistance = scaledDistance.div(adjustedDivisor);
        if (normalizedDistance.gt(UINT64_MAX_BN)) {
            throw new Error(
                `Invalid normalized distance: ${normalizedDistance.toString()}. Max value: ${UINT64_MAX_BN.toString()}`,
            );
        }

        let normalizedStake = stakeScaleFactor
            .mul(mappedStake.sub(mappedMinStake))
            .div(mappedMaxStake.sub(mappedMinStake));
        if (normalizedStake.gt(UINT64_MAX_BN)) {
            normalizedStake = normalizedStake.mod(UINT64_MAX_BN.add(1));
        }

        const oneEther = await this.blockchainModuleManager.toBigNumber(
            blockchain,
            '1000000000000000000',
        );

        const isProximityScorePositive = oneEther.gte(normalizedDistance);

        const proximityScore = isProximityScorePositive
            ? oneEther.sub(normalizedDistance).mul(w1)
            : normalizedDistance.sub(oneEther).mul(w1);
        const stakeScore = normalizedStake.mul(w2);

        let finalScore;
        if (isProximityScorePositive) {
            finalScore = proximityScore.add(stakeScore);
        } else if (stakeScore.gte(proximityScore)) {
            finalScore = stakeScore.sub(proximityScore);
        } else {
            finalScore = await this.blockchainModuleManager.toBigNumber(blockchain, 0);
        }

        finalScore = this._toUint40(finalScore, oneEther.mul(w1 + w2));

        if (returnIntermediateValues) {
            return {
                normalizedDistance,
                normalizedStake,
                proximityScore,
                stakeScore,
                finalScore,
            };
        }

        return finalScore.toNumber();
    }

    _toUint40(value, maxValue) {
        return value.mul(UINT40_MAX_BN).div(maxValue);
    }
}

export default ProximityScoringService;
