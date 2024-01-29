import { xor as uint8ArrayXor } from 'uint8arrays/xor';
import { HASH_RING_SIZE, UINT128_MAX_BN } from '../constants/constants.js';

class ProximityScoringService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;

        this.proximityScoreFunctionsPairs = {
            1: [this.calculateBinaryXOR.bind(this), this.Log2PLDSF.bind(this)],
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

        return {
            mappedDistance,
            mappedStake,
            score: Math.floor(
                Number(multiplier) *
                    Math.log2(
                        Number(logArgumentConstant) + dividend.toNumber() / divisor.toNumber(),
                    ),
            ),
        };
    }

    async linearSum(blockchain, distance, stake, maxNeighborhoodDistance) {
        const linearSumParams = await this.blockchainModuleManager.getLinearSumParams(blockchain);
        const { distanceScaleFactor, w1, w2 } = linearSumParams;
        const minimumStake = await this.blockchainModuleManager.getMinimumStake(blockchain);
        const maximumStake = await this.blockchainModuleManager.getMaximumStake(blockchain);

        let dividend = distance;
        let divisor = maxNeighborhoodDistance;
        if (dividend.gt(UINT128_MAX_BN) || divisor.gt(UINT128_MAX_BN)) {
            dividend = dividend.div(distanceScaleFactor);
            divisor = divisor.div(distanceScaleFactor);
        }

        const divResult = dividend.mul(distanceScaleFactor).div(divisor);

        const mappedDistance =
            parseFloat(divResult.toString()) / parseFloat(distanceScaleFactor.toString());
        const mappedStake = (stake - minimumStake) / (maximumStake - minimumStake);

        const proximityScore = w1 * (1 - mappedDistance);
        const stakeScore = w2 * mappedStake;

        return proximityScore + stakeScore;
    }
}

export default ProximityScoringService;
