const abi = require('ethereumjs-abi');
const constants = require('./constants');
const BN = require('bn.js');
const Utilities = require('./Utilities');
const { sha3_256 } = require('js-sha3');

class MerkleTree {
    generateLeafHash(leaf, index) {
        switch (this.hashFunction) {
        case 'soliditySha3':
            if (Buffer.from(`${leaf}`, 'utf8').byteLength > constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES) {
                throw Error('Block size is larger than 32 bytes.');
            }
            return abi.soliditySHA3(
                ['bytes32', 'uint256'],
                [Utilities.normalizeHex(Buffer.from(`${leaf}`, 'utf8').toString('hex')), index],
            ).toString('hex');

        case 'sha3': return sha3_256(`${leaf}${index}`);
        default: throw Error('Invalid hash function!');
        }
    }

    generateLitigationLeafHash(data, objectIndex, blockIndex) {
        switch (this.hashFunction) {
            case 'soliditySha3':
                if (Buffer.from(`${data}`, 'utf8').byteLength > constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES) {
                    throw Error(`Block size is larger than ${constants.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES} bytes.`);
                }
                return abi.soliditySHA3(
                    ['bytes32', 'uint256', 'uint256'],
                    [Utilities.normalizeHex(Buffer.from(`${data}`, 'utf8').toString('hex')), objectIndex, blockIndex],
                ).toString('hex');

            case 'sha3': return sha3_256(`${data}${objectIndex}${blockIndex}`);
            default: throw Error('Invalid hash function!');
        }
    }

    generateInternalHash(block1, block2) {
        switch (this.hashFunction) {
        case 'soliditySha3':
            return abi.soliditySHA3(
                ['bytes32', 'bytes32'],
                [
                    Utilities.normalizeHex(`${block1}`),
                    Utilities.normalizeHex(`${block2}`),
                ],
            ).toString('hex');

        case 'sha3': return sha3_256(`${Utilities.normalizeHex(block1)}${Utilities.normalizeHex(block2)}`);
        default: throw Error('Invalid hash function!');
        }
    }

    constructor(leaves, type = 'distribution', hashFunction = 'soliditySha3') {
        this.levels = [];
        this.levels.push(leaves);
        this.hashFunction = hashFunction;
        this.type = type;
        const leavesHashes = [];
        for (let i = 0; i < leaves.length; i += 1) {
            switch (this.type) {
                case "distribution":
                    leavesHashes.push(this.generateLeafHash(leaves[i], i));
                    break;
                case 'litigation':
                    leavesHashes.push(this.generateLitigationLeafHash(
                        leaves[i].data,
                        leaves[i].objectIndex,
                        leaves[i].blockIndex,
                    ));
                    break;
                default:
                    throw Error(`Unsupported Merkle tree type: ${type}`);
            }
        }

        this.levels.push(leavesHashes);

        let nextLevel = [];
        let currentLevel = leavesHashes;
        do {
            nextLevel = [];
            let i = 0;
            while (i < currentLevel.length) {
                if (i + 1 < currentLevel.length) {
                    const hash = this.generateInternalHash(
                        currentLevel[i],
                        currentLevel[i + 1],
                    );
                    nextLevel.push(hash);
                } else {
                    const hash = this.generateInternalHash(
                        currentLevel[i],
                        currentLevel[i],
                    );
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

    createProof(firstIndex, secondIndex = null) {
        let i;
        const { levels } = this;
        switch (this.type) {
            case 'distribution':
                i = firstIndex;
                break;
            case 'litigation':
                i = levels[0].findIndex(element =>
                    element.objectIndex === firstIndex && element.blockIndex === secondIndex);
                break;
            default:
                throw Error(`Unsupported Merkle tree type: ${this.type}`);
        }

        let currentLevel = 1;

        const proof = [];

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

    verifyProof(proof, data, firstIndex, secondIndex = null) {
        let h;
        let leafNumber;
        const { levels } = this;
        switch (this.type) {
            case 'distribution':
                leafNumber = firstIndex;
                h = this.generateLeafHash(data, firstIndex);
                break;
            case 'litigation':
                h = this.generateLitigationLeafHash(data, firstIndex, secondIndex);
                leafNumber = levels[0].findIndex(element =>
                    element.objectIndex === firstIndex && element.blockIndex === secondIndex);
                break;
            default:
                throw Error(`Unsupported Merkle tree type: ${this.type}`);
        }

        let j = this.levels.length - 1;
        let k = 0;
        let r = 0;

        while (j > 1) {
            r = leafNumber % 2;
            if (r % 2 === 0) {
                h = this.generateInternalHash(h, proof[k]);
            } else {
                h = this.generateInternalHash(proof[k], h);
            }

            k += 1;
            leafNumber = Math.trunc(leafNumber / 2);
            j -= 1;
        }
        return h === this.rootHash;
    }
}

module.exports = MerkleTree;
