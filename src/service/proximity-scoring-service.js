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
            3: [this.calculateProximityOnHashRing.bind(this), this.LinearSum.bind(this)],
            4: [this.calculateProximityOnHashRing.bind(this), this.LinearDivision.bind(this)],
            5: [
                this.calculateProximityOnHashRing.bind(this),
                this.LinearEMANormalization.bind(this),
            ],
            6: [this.calculateRelativeDistance.bind(this), this.RelativeNormalization.bind(this)],
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

        const directDistance = peerPositionOnHashRing.gt(keyPositionOnHashRing)
            ? peerPositionOnHashRing.sub(keyPositionOnHashRing)
            : keyPositionOnHashRing.sub(peerPositionOnHashRing);
        const wraparoundDistance = HASH_RING_SIZE.sub(directDistance);

        return directDistance.lt(wraparoundDistance) ? directDistance : wraparoundDistance;
    }

    async calculateRelativeDistance(blockchain, peerHash, keyHash, nodes) {
        const peerHashBN = await this.blockchainModuleManager.toBigNumber(blockchain, peerHash);
        const keyHashBN = await this.blockchainModuleManager.toBigNumber(blockchain, keyHash);

        const positions = await Promise.all(
            nodes.map(async (node) =>
                this.blockchainModuleManager.toBigNumber(blockchain, node.sha256),
            ),
        );

        const closestNode = positions.reduce((prev, curr) => {
            const diffCurr = curr.sub(keyHashBN).abs();
            const diffPrev = prev.sub(keyHashBN).abs();

            return diffCurr.lt(diffPrev) ? curr : prev;
        });

        const sortedPositions = positions.sort((a, b) => a.sub(b));

        const closestNodeIndex = sortedPositions.findIndex((pos) => pos.eq(closestNode));
        const peerIndex = sortedPositions.findIndex((pos) => pos.eq(peerHashBN));

        return this.blockchainModuleManager.toBigNumber(
            blockchain,
            Math.abs(peerIndex - closestNodeIndex),
        );
    }

    async RelativeNormalization(blockchain, distance, stake) {
        const w1 = 3;
        const w2 = 1;

        const mappedDistance = distance / 10;
        const proximityScore = 1 - mappedDistance;
        const mappedStake = (stake - 50000) / (1000000 - 50000);

        const score = w1 * proximityScore + w2 * mappedStake;

        return { mappedDistance, mappedStake, score };
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

    // Using Maclaurin Series to approximate e^x
    _approximateExp(x, degree) {
        let xPow = x;
        let factorial = 1;
        let result = 1;

        for (let i = 1; i <= degree; i += 1) {
            factorial *= i;
            result += xPow / factorial;
            xPow *= x;
        }

        return result;
    }

    async LinearLogisticSum(blockchain, distance, stake, maxNeighborhoodDistance) {
        const linearLogisticSumParams =
            await this.blockchainModuleManager.getLinearLogisticSumParams(blockchain);
        const { distanceScaleFactor, exponentMultiplier, maclaurinSeriesDegree, x0, w1, w2 } =
            linearLogisticSumParams;

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
        const mappedStake = 2 / (1 + this._approximateExp(exponentPart, maclaurinSeriesDegree)) - 1;

        const proximityScore = w1 * (1 - mappedDistance);
        const stakeScore = w2 * mappedStake;

        return { mappedDistance, mappedStake, score: proximityScore + stakeScore };
    }

    async LinearSum(blockchain, distance, stake) {
        const linearSumParams = await this.blockchainModuleManager.getLinearSumParams(blockchain);
        const { distanceScaleFactor, w1, w2 } = linearSumParams;

        let dividend = distance;
        let divisor = HASH_RING_SIZE.div(2);
        if (dividend.gt(UINT128_MAX_BN) || divisor.gt(UINT128_MAX_BN)) {
            dividend = dividend.div(distanceScaleFactor);
            divisor = divisor.div(distanceScaleFactor);
        }

        const divResult = dividend.mul(distanceScaleFactor).div(divisor);
        const mappedDistance =
            parseFloat(divResult.toString()) / parseFloat(distanceScaleFactor.toString());

        const maxStake = await this.blockchainModuleManager.getMaximumStake(blockchain);
        const mappedStake =
            stake / Number(await this.blockchainModuleManager.convertFromWei(maxStake));

        const proximityScore = w1 * (1 - mappedDistance);
        const stakeScore = w2 * mappedStake;

        return { mappedDistance, mappedStake, score: proximityScore + stakeScore };
    }

    async LinearDivision(blockchain, distance, stake) {
        const linearDivisionParams = await this.blockchainModuleManager.getLinearDivisionParams(
            blockchain,
        );
        const { distanceScaleFactor, w1, w2 } = linearDivisionParams;

        let dividend = distance;
        let divisor = HASH_RING_SIZE.div(2);
        if (dividend.gt(UINT128_MAX_BN) || divisor.gt(UINT128_MAX_BN)) {
            dividend = dividend.div(distanceScaleFactor);
            divisor = divisor.div(distanceScaleFactor);
        }

        const divResult = dividend.mul(distanceScaleFactor).div(divisor);
        const mappedDistance =
            parseFloat(divResult.toString()) / parseFloat(distanceScaleFactor.toString());

        const maxStake = await this.blockchainModuleManager.getMaximumStake(blockchain);
        const mappedStake =
            Math.log(stake + 1) /
            Math.log(1 + Number(await this.blockchainModuleManager.convertFromWei(maxStake)));

        const proximityScore = w1 * (1 - mappedDistance);
        const stakeScore = w2 * mappedStake;

        return { mappedDistance, mappedStake, score: stakeScore / proximityScore };
    }

    async LinearEMANormalization(blockchain, distance, stake, nodeDistanceEMA) {
        // const linearEMANormalizationParams = await this.blockchainModuleManager.getLinearEMANormalizationParams(blockchain);
        // const { w1, w2 } = linearEMANormalizationParams;

        const w1 = 2;
        const w2 = 1;

        const distanceScaleFactor = '1000000000000000000';

        let dividend = distance;
        let divisor = nodeDistanceEMA;
        if (dividend.gt(UINT128_MAX_BN) || divisor.gt(UINT128_MAX_BN)) {
            dividend = dividend.div(distanceScaleFactor);
            divisor = divisor.div(distanceScaleFactor);
        }

        const divResult = dividend.mul(distanceScaleFactor).div(divisor);
        const mappedDistance =
            parseFloat(divResult.toString()) / parseFloat(distanceScaleFactor.toString());

        const maxStake = await this.blockchainModuleManager.getMaximumStake(blockchain);
        const mappedStake =
            stake / Number(await this.blockchainModuleManager.convertFromWei(maxStake));

        const proximityScore = w1 * (1 - mappedDistance);
        const stakeScore = w2 * mappedStake;

        return { mappedDistance, mappedStake, score: proximityScore + stakeScore };
    }
}

export default ProximityScoringService;
