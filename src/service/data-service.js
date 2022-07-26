const jsonld = require("jsonld");

const ALGORITHM = 'URDNA2015';
const FORMAT = 'application/n-quads';
const CONTEXT = 'https://schema.org/';

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    async toNQuads(content, inputFormat) {
        const options = {
            algorithm: ALGORITHM,
            format: FORMAT,
        }
        
        if(inputFormat) {
            options.inputFormat = inputFormat;
        }

        const canonized = await jsonld.canonize(content, options);

        return canonized.split("\n").filter((x) => x !== "");
    }

    async compact(content) {
        const result = await jsonld.compact(content, {
            '@context': CONTEXT,
        });

        return result;
    }

    async canonize(content) {
        const nquads = await this.toNQuads(content);
        if (nquads && nquads.length === 0) {
            throw new Error("File format is corrupted, no n-quads extracted.");
        }

        return nquads;
    }

    async metadataObjectToNquads(metadata) {
        const metadataCopy = JSON.parse(JSON.stringify(metadata));
        if (!metadataCopy['@context']) {
            metadataCopy['@context'] = CONTEXT;
        }

        const nquads = await this.canonize(metadataCopy);

        return nquads;
    }
}

module.exports = DataService;
