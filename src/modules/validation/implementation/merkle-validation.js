import keccak256 from 'keccak256';
import web3 from 'web3';
import { MerkleTree } from 'merkletreejs';
import { calculateRoot } from 'assertion-tools';

class MerkleValidation {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    calculateRoot(assertion) {
        return calculateRoot(assertion);
    }

    // TODO move to assertion-tools
    getMerkleProof(nquadsArray, challenge) {
        nquadsArray.sort();

        const leaves = nquadsArray.map((element, index) =>
            keccak256(web3.utils.encodePacked(keccak256(element), index)),
        );
        const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

        const proof = tree.getProof(leaves[parseInt(challenge, 10)]);

        return { leaf: leaves[parseInt(challenge, 10)], proof: proof.map((x) => x.data) };
    }
}

export default MerkleValidation;
