const MerkleTree = require('@garbados/merkle-tree');

class MTree {
	constructor(dataArray) {
		this.dataArray = dataArray;
		this.tree = new MerkleTree('sha256', dataArray);
	}

	root() {
		return this.tree.root;
	}

	verifyLeaf(leaf) {
		let proof = this.tree.proof(leaf);
		return this.tree.leaves[leaf] === proof[0][0];
	}

	verifyLeaves(leaves) {
		leaves.forEach(function(leaf) {
			if(this.verifyLeaf(leaf) === false) {
				return false;
			}
		});
		return true;
	}

}

module.exports = MTree;

//TODO: tests