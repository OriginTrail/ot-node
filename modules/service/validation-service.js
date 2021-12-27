const sortedStringify = require('json-stable-stringify');

class ValidationService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.constants = ctx.constants;
    }

    initialize(implementation) {
        this.validation = implementation;
        return this.validation.initialize(this.logger);
    }

    calculateHash(assertion) {
        if (typeof assertion !== 'string' && !(assertion instanceof String))
            assertion = sortedStringify(assertion)
        return this.validation.calculateHash(assertion);
    }

    calculateRootHash(rdf) {
        rdf.sort();
        return this.validation.calculateRootHash(rdf);
    }

    async getProofs(rdf, nquads) {
        rdf.sort();
        const tree = this.validation.getMerkleTree(rdf);
        const result = [];
        for (let triple of nquads) {
            triple = triple.replace(/_:genid(.){37}/gm, '_:$1');
            const index = rdf.indexOf(triple);
            const proof = tree.getProof(index);
            result.push({ triple, tripleHash: this.validation.calculateHash(triple), proof });
        }

        return result;
    }

    sign(assertionId) {
        return this.validation.sign(assertionId, this.config.blockchain.config.privateKey);
    }

    verify(assertionId, signature, issuer) {
        return this.validation.verify(assertionId, signature, issuer);
    }

    getIssuer() {
        return this.config.blockchain.config.publicKey.toLowerCase();
    }

    createProofs(assertion, triples) {
        return this.validation.createProofs(assertion, triples);
    }

    validateProof(triples, proofs, root) {
        return this.validation.validateProof(triples, proofs, root);
    }
}

module.exports = ValidationService;
