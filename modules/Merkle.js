const abi = require('ethereumjs-abi');
const BN = require('bn.js');
const Utilities = require('./Utilities');

class MerkleTree {
    constructor(leaves) {
        this.levels = [];
        this.levels.push(leaves);

        const leavesHashes = [];
        for (let i = 0; i < leaves.length; i += 1) {
            const hash = abi.soliditySHA3(
                ['bytes32', 'uint256'],
                [Utilities.normalizeHex(Buffer.from(leaves[i], 'utf8').toString('hex')), i],
            ).toString('hex');

            leavesHashes.push(hash);
        }

        this.levels.push(leavesHashes);

        let nextLevel = [];
        let currentLevel = leavesHashes;
        do {
            nextLevel = [];
            let i = 0;
            while (i < currentLevel.length) {
                if (i + 1 < currentLevel.length) {
                    const hash = abi.soliditySHA3(
                        ['bytes32', 'bytes32'],
                        [
                            Utilities.normalizeHex(currentLevel[i]),
                            Utilities.normalizeHex(currentLevel[i + 1]),
                        ],
                    ).toString('hex');
                    nextLevel.push(hash);
                } else {
                    const hash = abi.soliditySHA3(
                        ['bytes32', 'bytes32'],
                        [
                            Utilities.normalizeHex(currentLevel[i]),
                            Utilities.normalizeHex(currentLevel[i]),
                        ],
                    ).toString('hex');
                    nextLevel.push(hash);
                }
                i += 2;
            }
            this.levels.push(nextLevel);
            currentLevel = nextLevel;
        } while (currentLevel.length > 1);

        [this.rootHash] = currentLevel;
    }

    getRoot() {
        return `0x${this.rootHash}`;
    }

    createProof(leafNumber) {
        const { levels } = this;

        let currentLevel = 1;

        const proof = [];

        let i = leafNumber;

        while (currentLevel < levels.length - 1) {
            if (i % 2 === 1) {
                proof.push(`0x${levels[currentLevel][i - 1]}`);
            } else if ((i + 1) < levels[currentLevel].length) {
                proof.push(`0x${levels[currentLevel][i + 1]}`);
            } else {
                proof.push(`0x${levels[currentLevel][i]}`);
            }

            currentLevel += 1;
            i = Math.trunc(i / 2);
        }

        return proof;
    }

    verifyProof(proof, block, i) {
        let h = abi.soliditySHA3(
            ['bytes32', 'uint256'],
            [
                Utilities.normalizeHex(Buffer.from(block, 'utf8').toString('hex')),
                i,
            ],
        ).toString('hex');

        let j = this.levels.length - 1;
        let k = 0;
        let r = 0;

        while (j > 1) {
            r = i % 2;
            if (r % 2 === 0) {
                h = abi.soliditySHA3(
                    ['bytes32', 'bytes32'],
                    [
                        Utilities.normalizeHex(h),
                        Utilities.normalizeHex(proof[k]),
                    ],
                ).toString('hex');
            } else {
                h = abi.soliditySHA3(
                    ['bytes32', 'bytes32'],
                    [
                        Utilities.normalizeHex(proof[k]),
                        Utilities.normalizeHex(h)],
                ).toString('hex');
            }

            k += 1;
            i = Math.trunc(i / 2);
            j -= 1;
        }

        return h === this.rootHash;
    }
}

module.exports = MerkleTree;
