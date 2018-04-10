const MerkleTree = require('@garbados/merkle-tree');
const crypto = require('crypto');

module.exports = () => {
    class MTree {
        constructor(dataArray) {
            this.dataArray = dataArray;
            this.tree = new MerkleTree('sha256', dataArray);
        }

        root() {
            return this.tree.root;
        }

        // eslint-disable-next-line class-methods-use-this
        digestFn(hashType, data) {
            // eslint-disable-next-line no-param-reassign
            if (typeof data !== 'string') data = JSON.stringify(data);
            const hash = crypto.createHash(hashType);
            hash.update(data);
            return hash.digest('hex');
        }

        verifyLeaf(leaf_index) {
            if (leaf_index >= this.tree.leaves.length || leaf_index < 0) { return false; }

            const proof = this.tree.proof(leaf_index);
            return proof[0].indexOf(this.tree.leaves[leaf_index]) !== -1;
        }

        verifyLeaves(test_leaves) {
            for (const i in test_leaves) {
                const test_leaf = test_leaves[i];

                const test_leaf_index = this.findIndex(test_leaf);

                if (this.verifyLeaf(test_leaf_index) === false) {
                    return false;
                }
            }
            return true;
        }

        findIndex(leaf) {
            const test_leaf_hash = this.digestFn('sha256', leaf);
            return this.tree.leaves.indexOf(test_leaf_hash);
        }
    }

    return MTree;
};
