const { describe, it } = require('mocha');
const { assert, expect } = require('chai');
const abi = require('ethereumjs-abi');
const { sha3_256 } = require('js-sha3');

const Utilities = require('../../modules/Utilities');
const Merkle = require('../../modules/Merkle');

describe('Merkle module', () => {
    function solidityLitigationLeafHash(leaf, objectIndex, blockIndex) {
        return abi.soliditySHA3(
            ['bytes32', 'uint256', 'uint256'],
            [Utilities.normalizeHex(Buffer.from(`${leaf}`, 'utf8').toString('hex').padStart(64, '0')), objectIndex, blockIndex],
        ).toString('hex');
    }

    function solidityDistributionLeafHash(leaf, index) {
        return abi.soliditySHA3(
            ['bytes32', 'uint256', 'uint256'],
            [Utilities.normalizeHex(Buffer.from(`${leaf}`, 'utf8').toString('hex')), index],
        ).toString('hex');
    }

    function solidityInternalHash(block1, block2) {
        return abi.soliditySHA3(
            ['bytes32', 'bytes32'],
            [
                Utilities.normalizeHex(`${block1}`),
                Utilities.normalizeHex(`${block2}`),
            ],
        ).toString('hex');
    }

    function sha3LitigationLeafHash(leaf, objectIndex, blockIndex) {
        return sha3_256(`${leaf}${objectIndex}${blockIndex}`);
    }

    function sha3DistributionLeafHash(leaf, index) {
        return sha3_256(`${leaf}${index}`);
    }

    function sha3InternalHash(block1, block2) {
        return sha3_256(`${Utilities.normalizeHex(block1)}${Utilities.normalizeHex(block2)}`);
    }

    it('Solidity SHA3: Constructing trivial tree, type is litigation, expect valid root', () => {
        const block = [{
            data: ['A'],
            objectIndex: 0,
            blockIndex: 0,
        }];
        const tree1 = new Merkle(block, 'litigation', 'soliditySha3');
        const tree2 = new Merkle(block, 'litigation', 'soliditySha3');

        const leafHash = solidityLitigationLeafHash('A', 0, 0);

        assert.equal(tree1.getRoot(), tree2.getRoot());
        assert.equal(tree1.getRoot(), `0x${solidityInternalHash(leafHash, leafHash)}`);
        expect(tree1).to.be.an.instanceof(Merkle);
        expect(tree2).to.be.an.instanceof(Merkle);
    });

    it('Solidity SHA3: Constructing tree with even number of leaves, type is litigation, expect valid root', () => {
        const data = [
            {
                data: 'A',
                objectIndex: 0,
                blockIndex: 0,
            },
            {
                data: 'B',
                objectIndex: 0,
                blockIndex: 1,
            },
            {
                data: 'C',
                objectIndex: 1,
                blockIndex: 0,
            },
            {
                data: 'D',
                objectIndex: 2,
                blockIndex: 0,
            },
        ];
        const tree = new Merkle(data, 'litigation', 'soliditySha3');

        const leafHash1 = solidityLitigationLeafHash('A', 0, 0);
        const leafHash2 = solidityLitigationLeafHash('B', 0, 1);
        const leafHash3 = solidityLitigationLeafHash('C', 1, 0);
        const leafHash4 = solidityLitigationLeafHash('D', 2, 0);

        const internalHash1 = solidityInternalHash(leafHash1, leafHash2);
        const internalHash2 = solidityInternalHash(leafHash3, leafHash4);

        const rootHash = solidityInternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });


    it('Solidity SHA3: Constructing tree with odd number of leaves, type is litigation, expect valid root', () => {
        const data = [
            {
                data: 'A',
                objectIndex: 0,
                blockIndex: 0,
            },
            {
                data: 'B',
                objectIndex: 0,
                blockIndex: 1,
            },
            {
                data: 'C',
                objectIndex: 1,
                blockIndex: 0,
            },
        ];
        const tree = new Merkle(data, 'litigation', 'soliditySha3');

        const leafHash1 = solidityLitigationLeafHash('A', 0, 0);
        const leafHash2 = solidityLitigationLeafHash('B', 0, 1);
        const leafHash3 = solidityLitigationLeafHash('C', 1, 0);

        const internalHash1 = solidityInternalHash(leafHash1, leafHash2);
        const internalHash2 = solidityInternalHash(leafHash3, leafHash3);

        const rootHash = solidityInternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('Solidity SHA3: Generate and verify valid proofs, type is litigation, expect valid root', () => {
        const data = [
            {
                data: 'A',
                objectIndex: 0,
                blockIndex: 0,
            },
            {
                data: 'B',
                objectIndex: 0,
                blockIndex: 1,
            },
            {
                data: 'C',
                objectIndex: 1,
                blockIndex: 0,
            },
            {
                data: 'D',
                objectIndex: 2,
                blockIndex: 0,
            },
        ];
        const tree = new Merkle(data, 'litigation', 'soliditySha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (const element of data) {
            const proof = tree.createProof(element.objectIndex, element.blockIndex);
            assert.isTrue(tree.verifyProof(
                proof,
                element.data,
                element.objectIndex,
                element.blockIndex,
            ));
        }
    });

    it('Solidity SHA3: Generate and verify invalid proofs, type is litigation, expect valid root', () => {
        const data = [
            {
                data: 'A',
                objectIndex: 0,
                blockIndex: 0,
            },
            {
                data: 'B',
                objectIndex: 0,
                blockIndex: 1,
            },
            {
                data: 'C',
                objectIndex: 1,
                blockIndex: 0,
            },
            {
                data: 'D',
                objectIndex: 2,
                blockIndex: 0,
            },
        ];
        const tree = new Merkle(data, 'litigation', 'soliditySha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (let i = 0; i < data.length; i += 1) {
            const proof = tree.createProof(data[i].objectIndex, data[i].blockIndex);
            if (i === data.length - 1) {
                assert.equal(
                    tree.verifyProof(
                        proof,
                        data[i].data,
                        data[i - 1].objectIndex,
                        data[i - 1].blockIndex,
                    ),
                    false,
                );
            } else {
                assert.isFalse(tree.verifyProof(
                    proof,
                    data[i].data,
                    data[i + 1].objectIndex,
                    data[i + 1].blockIndex,
                ));
            }
        }
    });

    it('Solidity SHA3: Exceeding block size limit, type is litigation, expect error', () => {
        const data = [
            {
                data: 'This value is more than 31 bytes ' +
                        'and Merkle tree construction should fail ' +
                        'for soliditySha3 hash function',
                objectIndex: 0,
                blockIndex: 0,
            },
            {
                data: 'B',
                objectIndex: 1,
                blockIndex: 0,
            },
            {
                data: 'C',
                objectIndex: 0,
                blockIndex: 1,
            },
            {
                data: 'D',
                objectIndex: 2,
                blockIndex: 0,
            },
        ];

        try {
            // eslint-disable-next-line no-new
            new Merkle(data, 'litigation', 'soliditySha3');
        } catch (err) {
            assert.equal(err.message, 'Block size is larger than 31 bytes.');
        }
    });

    it('SHA3: Constructing trivial tree, type is distribution, expect valid root', () => {
        const data = ['A'];
        const tree = new Merkle(data, 'distribution', 'sha3');

        const leafHash = sha3DistributionLeafHash('A', 0);
        assert.equal(tree.getRoot(), `0x${sha3InternalHash(leafHash, leafHash)}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Constructing tree with even number of leaves, type is distribution, expect valid root', () => {
        const data = ['A', 'B', 'C', 'D'];

        const tree = new Merkle(data, 'distribution', 'sha3');

        const leafHash1 = sha3DistributionLeafHash('A', 0);
        const leafHash2 = sha3DistributionLeafHash('B', 1);
        const leafHash3 = sha3DistributionLeafHash('C', 2);
        const leafHash4 = sha3DistributionLeafHash('D', 3);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash4);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);

        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });


    it('SHA3: Constructing tree with odd number of leaves, type is distribution, expect valid root', () => {
        const data = ['A', 'B', 'C'];
        const tree = new Merkle(data, 'distribution', 'sha3');

        const leafHash1 = sha3DistributionLeafHash('A', 0);
        const leafHash2 = sha3DistributionLeafHash('B', 1);
        const leafHash3 = sha3DistributionLeafHash('C', 2);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash3);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Generate and verify valid proofs, type is distribution, expect verify proof return true', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'distribution', 'sha3');

        expect(tree).to.be.an.instanceof(Merkle);

        data.forEach((element, index) => {
            const proof = tree.createProof(index);
            assert.isTrue(tree.verifyProof(proof, element, index));
        });
    });

    it('SHA3: Generate and verify invalid proofs, type is distribution, expect verify proof return false', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'distribution', 'sha3');

        expect(tree).to.be.an.instanceof(Merkle);

        const proofs = [];
        data.forEach((element, index) => {
            const proof = tree.createProof(index);
            proofs.push(proof);
        });

        proofs.forEach((proof, index) => {
            const verified = tree.verifyProof(proof, data[(index + 1) % proofs.length], index);
            assert.isFalse(verified);
        });
    });

    it('Solidity SHA3: Exceeding block size limit, type is distribution, expect error', () => {
        const data = [`This value is more than 31 bytes
                    and Merkle tree construction should fail
                    for soliditySha3 hash function`,
        'B', 'C', 'D'];

        try {
            // eslint-disable-next-line no-new
            new Merkle(data, 'distribution', 'soliditySha3');
        } catch (err) {
            assert.equal(err.message, 'Block size is larger than 31 bytes.');
        }
    });

    it('Unsupported tree type, type is test, expect error', () => {
        const data = ['A', 'B', 'C', 'D'];
        try {
            // eslint-disable-next-line no-new
            new Merkle(data, 'test', 'soliditySha3');
        } catch (err) {
            assert.equal(err.message, 'Unsupported Merkle tree type: test');
        }
    });
});
