const { describe, it } = require('mocha');
const { assert, expect } = require('chai');
const abi = require('ethereumjs-abi');
const { sha3_256 } = require('js-sha3');

const Utilities = require('../../modules/Utilities');
const Merkle = require('../../modules/Merkle');

describe('Merkle module', () => {
    function solidityLeafHash(leaf, objectIndex, blockIndex) {
        return abi.soliditySHA3(
            ['bytes32', 'uint256', 'uint256'],
            [Utilities.normalizeHex(Buffer.from(`${leaf}`, 'utf8').toString('hex')), objectIndex, blockIndex],
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

    function sha3LeafHash(leaf, objectIndex, blockIndex) {
        return sha3_256(`${leaf}${objectIndex}${blockIndex}`);
    }

    function sha3InternalHash(block1, block2) {
        return sha3_256(`${Utilities.normalizeHex(block1)}${Utilities.normalizeHex(block2)}`);
    }

    it('Solidity SHA3: Constructing trivial tree', () => {
        const block = [{
            data: ['A'],
            objectIndex: 0,
            blockIndex: 0,
        }];
        const tree1 = new Merkle(block);
        const tree2 = new Merkle(block, 'soliditySha3');

        const leafHash = solidityLeafHash('A', 0, 0);

        assert.equal(tree1.getRoot(), tree2.getRoot());
        assert.equal(tree1.getRoot(), `0x${solidityInternalHash(leafHash, leafHash)}`);
        expect(tree1).to.be.an.instanceof(Merkle);
        expect(tree2).to.be.an.instanceof(Merkle);
    });

    it('Solidity SHA3: Constructing tree with even number of leaves', () => {
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
        const tree = new Merkle(data, 'soliditySha3');

        const leafHash1 = solidityLeafHash('A', 0, 0);
        const leafHash2 = solidityLeafHash('B', 0, 1);
        const leafHash3 = solidityLeafHash('C', 1, 0);
        const leafHash4 = solidityLeafHash('D', 2, 0);

        const internalHash1 = solidityInternalHash(leafHash1, leafHash2);
        const internalHash2 = solidityInternalHash(leafHash3, leafHash4);

        const rootHash = solidityInternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });


    it('Solidity SHA3: Constructing tree with odd number of leaves', () => {
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
        const tree = new Merkle(data, 'soliditySha3');

        const leafHash1 = solidityLeafHash('A', 0, 0);
        const leafHash2 = solidityLeafHash('B', 0, 1);
        const leafHash3 = solidityLeafHash('C', 1, 0);

        const internalHash1 = solidityInternalHash(leafHash1, leafHash2);
        const internalHash2 = solidityInternalHash(leafHash3, leafHash3);

        const rootHash = solidityInternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('Solidity SHA3: Generate and verify valid proofs', () => {
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
        const tree = new Merkle(data, 'soliditySha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (const element of data) {
            const proof = tree.createProof(element.objectIndex, element.blockIndex);
            assert.equal(
                tree.verifyProof(proof, element.data, element.objectIndex, element.blockIndex),
                true,
            );
        }
    });

    it('Solidity SHA3: Generate and verify invalid proofs', () => {
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
        const tree = new Merkle(data, 'soliditySha3');

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
                assert.equal(
                    tree.verifyProof(
                        proof,
                        data[i].data,
                        data[i + 1].objectIndex,
                        data[i + 1].blockIndex,
                    ),
                    false,
                );
            }
        }
    });

    it('Solidity SHA3: Exceeding block size limit', () => {
        const data = [
            {
                data: 'This value is more than 32 bytes ' +
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
            const tree = new Merkle(data, 'soliditySha3');
            assert.equal(true, false);
        } catch (err) {
            assert.equal(err.message, 'Block size is larger than 32 bytes.');
        }
    });

    it('SHA3: Constructing trivial tree', () => {
        const data = [{
            data: 'A',
            objectIndex: 0,
            blockIndex: 0,
        }];
        const tree = new Merkle(data, 'sha3');

        const leafHash = sha3LeafHash('A', 0,0);
        assert.equal(tree.getRoot(), `0x${sha3InternalHash(leafHash, leafHash)}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Constructing tree with even number of leaves', () => {
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
        ]
        const tree = new Merkle(data, 'sha3');

        const leafHash1 = sha3LeafHash('A', 0,0);
        const leafHash2 = sha3LeafHash('B', 0,1);
        const leafHash3 = sha3LeafHash('C', 1,0);
        const leafHash4 = sha3LeafHash('D', 2,0);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash4);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });


    it('SHA3: Constructing tree with odd number of leaves', () => {
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
        ]
        const tree = new Merkle(data, 'sha3');

        const leafHash1 = sha3LeafHash('A', 0, 0);
        const leafHash2 = sha3LeafHash('B', 0, 1);
        const leafHash3 = sha3LeafHash('C', 1, 0);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash3);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Constructing tree with odd number of leaves', () => {
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
        ]
        const tree = new Merkle(data, 'sha3');

        const leafHash1 = sha3LeafHash('A', 0, 0);
        const leafHash2 = sha3LeafHash('B', 0, 1);
        const leafHash3 = sha3LeafHash('C', 1, 0);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash3);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Generate and verify valid proofs', () => {
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
        ]
        const tree = new Merkle(data, 'sha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (const element of data) {
            const proof = tree.createProof(element.objectIndex, element.blockIndex);
            assert.equal(tree.verifyProof(proof, element.data, element.objectIndex, element.blockIndex), true);
        };
    });

    it('SHA3: Generate and verify invalid proofs', () => {
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
        ]
        const tree = new Merkle(data, 'sha3');

        expect(tree).to.be.an.instanceof(Merkle);

        const proofs = [];
        for (const element of data) {
            const proof = tree.createProof(element.objectIndex, element.blockIndex);
            proofs.push(proof);
        }

        for (let i = 0; i < proofs.length; i += 1) {
            assert.equal(tree.verifyProof(proofs[(i + 1) % proofs.length],
                data[i].data, data[i].objectIndex, data[i].blockIndex), false);
        }
    });
});
