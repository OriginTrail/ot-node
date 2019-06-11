const { describe, it } = require('mocha');
const { assert, expect } = require('chai');
const abi = require('ethereumjs-abi');
const { sha3_256 } = require('js-sha3');

const Utilities = require('../../modules/Utilities');
const Merkle = require('../../modules/Merkle');

function solidityLeafHash(leaf, index) {
    return abi.soliditySHA3(
        ['bytes32', 'uint256'],
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

function sha3LeafHash(leaf, index) {
    return sha3_256(`${leaf}${index}`);
}

function sha3InternalHash(block1, block2) {
    return sha3_256(`${Utilities.normalizeHex(block1)}${Utilities.normalizeHex(block2)}`);
}


describe('Merkle module', () => {
    it('Solidity SHA3: Constructing trivial tree', () => {
        const data = ['A'];
        const tree1 = new Merkle(data);
        const tree2 = new Merkle(data, 'soliditySha3');

        const leafHash = solidityLeafHash('A', 0);

        assert.equal(tree1.getRoot(), tree2.getRoot());
        assert.equal(tree1.getRoot(), `0x${solidityInternalHash(leafHash, leafHash)}`);
        expect(tree1).to.be.an.instanceof(Merkle);
        expect(tree2).to.be.an.instanceof(Merkle);
    });

    it('Solidity SHA3: Constructing tree with even number of leaves', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'soliditySha3');

        const leafHash1 = solidityLeafHash('A', 0);
        const leafHash2 = solidityLeafHash('B', 1);
        const leafHash3 = solidityLeafHash('C', 2);
        const leafHash4 = solidityLeafHash('D', 3);

        const internalHash1 = solidityInternalHash(leafHash1, leafHash2);
        const internalHash2 = solidityInternalHash(leafHash3, leafHash4);

        const rootHash = solidityInternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });


    it('Solidity SHA3: Constructing tree with odd number of leaves', () => {
        const data = ['A', 'B', 'C'];
        const tree = new Merkle(data, 'soliditySha3');

        const leafHash1 = solidityLeafHash('A', 0);
        const leafHash2 = solidityLeafHash('B', 1);
        const leafHash3 = solidityLeafHash('C', 2);

        const internalHash1 = solidityInternalHash(leafHash1, leafHash2);
        const internalHash2 = solidityInternalHash(leafHash3, leafHash3);

        const rootHash = solidityInternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('Solidity SHA3: Generate and verify valid proofs', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'soliditySha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (let i = 0; i < data.length; i += 1) {
            const proof = tree.createProof(i);
            assert.equal(tree.verifyProof(proof, data[i], i), true);
        }
    });

    it('Solidity SHA3: Generate and verify valid proofs', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'soliditySha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (let i = 0; i < data.length; i += 1) {
            const proof = tree.createProof(i - 1);
            assert.equal(tree.verifyProof(proof, data[i], i), false);
        }
    });

    it('Solidity SHA3: Exceeding block size limit', () => {
        const data = ['This value is more than 32 bytes ' +
                      'and Merkle tree construction should fail ' +
                      'for soliditySha3 hash function', 'B', 'C', 'D'];

        try {
            const tree = new Merkle(data, 'soliditySha3');
            assert.equal(true, false);
        } catch (err) {
            assert.equal(err.message, 'Block size is larger than 32 bytes.');
        }
    });

    it('SHA3: Constructing trivial tree', () => {
        const data = ['A'];
        const tree = new Merkle(data, 'sha3');

        const leafHash = sha3LeafHash('A', 0);
        assert.equal(tree.getRoot(), `0x${sha3InternalHash(leafHash, leafHash)}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Constructing tree with even number of leaves', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'sha3');

        const leafHash1 = sha3LeafHash('A', 0);
        const leafHash2 = sha3LeafHash('B', 1);
        const leafHash3 = sha3LeafHash('C', 2);
        const leafHash4 = sha3LeafHash('D', 3);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash4);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });


    it('SHA3: Constructing tree with odd number of leaves', () => {
        const data = ['A', 'B', 'C'];
        const tree = new Merkle(data, 'sha3');

        const leafHash1 = sha3LeafHash('A', 0);
        const leafHash2 = sha3LeafHash('B', 1);
        const leafHash3 = sha3LeafHash('C', 2);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash3);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Constructing tree with odd number of leaves', () => {
        const data = ['A', 'B', 'C'];
        const tree = new Merkle(data, 'sha3');

        const leafHash1 = sha3LeafHash('A', 0);
        const leafHash2 = sha3LeafHash('B', 1);
        const leafHash3 = sha3LeafHash('C', 2);

        const internalHash1 = sha3InternalHash(leafHash1, leafHash2);
        const internalHash2 = sha3InternalHash(leafHash3, leafHash3);

        const rootHash = sha3InternalHash(internalHash1, internalHash2);


        assert.equal(tree.getRoot(), `0x${rootHash}`);

        expect(tree).to.be.an.instanceof(Merkle);
    });

    it('SHA3: Generate and verify valid proofs', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'sha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (let i = 0; i < data.length; i += 1) {
            const proof = tree.createProof(i);
            assert.equal(tree.verifyProof(proof, data[i], i), true);
        }
    });

    it('SHA3: Generate and verify invalid proofs', () => {
        const data = ['A', 'B', 'C', 'D'];
        const tree = new Merkle(data, 'sha3');

        expect(tree).to.be.an.instanceof(Merkle);

        for (let i = 1; i < data.length; i += 1) {
            const proof = tree.createProof(i - 1);
            assert.equal(tree.verifyProof(proof, data[i], i), false);
        }
    });
});
