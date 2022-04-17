const workerpool = require('workerpool');
const jsonld = require('jsonld');

function JSONParse(args) {
    return JSON.parse(args);
}

function JSONStringify(args) {
    return JSON.stringify(args);
}

async function toNQuads(json) {
    const canonized = await jsonld.canonize(json, {
        algorithm: 'URDNA2015',
        format: 'application/n-quads',
    });

    return canonized.split('\n').filter((x) => x !== '');
}

function fromNQuads(nquads, context, frame) {
    return new Promise((accept, reject) => {
        jsonld.fromRDF(nquads.join('\n'), {
            algorithm: 'URDNA2015',
            format: 'application/n-quads',
        })
        .then((json) => frame && Object.keys(frame).length !== 0 ? jsonld.frame(json, frame) : json)
        .then((json) => jsonld.compact(json, context))
        .then((result) => {
            accept(result);
        })
        .catch((err) => reject(err));
    });
}

workerpool.worker({
    JSONParse,
    JSONStringify,
    toNQuads,
    fromNQuads,
});
