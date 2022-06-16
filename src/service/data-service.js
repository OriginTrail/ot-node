const jsonld = require("jsonld");

class DataService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    async toNQuads(content) {
        const canonized = await jsonld.canonize(content, {
            algorithm: "URDNA2015",
            format: "application/n-quads",
        });

        return canonized.split("\n").filter((x) => x !== "");
    }

    async compact(content) {
        const result = await jsonld.compact(content, {
            "@context": "https://schema.org/",
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
}

module.exports = DataService;
