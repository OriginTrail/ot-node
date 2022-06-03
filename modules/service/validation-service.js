const sortedStringify = require('json-stable-stringify');
const MarkleValidation = require('../../external/merkle-validation-service');

class ValidationService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.constants = ctx.constants;
    }

    initialize() {
        this.implementation = new MarkleValidation();
        return this.implementation.initialize(this.logger);
    }

    getName() {
        return this.implementation.getName();
    }

    calculateHash(assertion) {
        if (typeof assertion !== 'string' && !(assertion instanceof String)) assertion = sortedStringify(assertion);
        return this.implementation.calculateHash(assertion);
    }

    calculateRootHash(rdf) {
        rdf.sort();
        return this.implementation.calculateRootHash(rdf);
    }

    async getProofs(rdf, nquads) {
        rdf.sort();
        const tree = this.implementation.getMerkleTree(rdf);
        const result = [];
        for (let triple of nquads) {
            triple = triple.replace(/_:genid(.){37}/gm, '_:$1');
            const index = rdf.indexOf(triple);
            const proof = tree.getProof(index);
            result.push({ triple, tripleHash: this.implementation.calculateHash(triple), proof });
        }

        return result;
    }

    sign(assertionId) {
        return this.implementation.sign(assertionId, this.config.modules.blockchain.implementation['web3-service'].config.privateKey);
    }

    verify(assertionId, signature, issuer) {
        return this.implementation.verify(assertionId, signature, issuer);
    }

    getIssuer() {
        return this.config.modules.blockchain.implementation['web3-service'].config.publicKey.toLowerCase();
    }

    createProofs(assertion, triples) {
        return this.implementation.createProofs(assertion, triples);
    }

    validateProof(triples, proofs, root) {
        return this.implementation.validateProof(triples, proofs, root);
    }
}

module.exports = ValidationService;
