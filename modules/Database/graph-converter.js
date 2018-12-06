
function denormalizeGraph(importId, vertices, edges) {
    const denormalizedVertices = [];
    const denormalizedEdges = edges;

    vertices.forEach((vertex) => {
        if (vertex.vertex_type !== 'IDENTIFIER' && vertex.vertex_type !== 'CLASS') {
            const denormalizedVertex = {
                [importId]: {},
            };

            // TODO: Clean quantity list
            denormalizedVertex[importId].data = vertex.data;
            if (vertex.identifiers) {
                denormalizedVertex.uid = vertex.identifiers.uid;
            }
            denormalizedVertex.sender_id = vertex.sender_id;
            if (vertex.private) {
                denormalizedVertex[importId].private = vertex.private;
            }
            if (vertex.randomness) {
                denormalizedVertex.randomness = vertex.randomness;
            }
            denormalizedVertex.private_salt = vertex.private_salt;

            denormalizedVertex._key = vertex._key;
            denormalizedVertex.vertex_type = vertex.vertex_type;
            denormalizedVertices.push(denormalizedVertex);
        } else {
            denormalizedVertices.push(vertex);
        }
    });

    return {
        vertices: denormalizedVertices,
        edges: denormalizedEdges,
    };
}

function normalizeGraph(importId, vertices, edges) {
    const normalizedVertices = [];
    const normalizedEdges = [];

    vertices.forEach((vertex) => {
        const normalizedVertex = {};
        if (vertex.vertex_type !== 'IDENTIFIER' && vertex[importId] && vertex.vertex_type !== 'CLASS') {
            normalizedVertex.data = vertex[importId].data;

            if (vertex._dc_key) {
                normalizedVertex._dc_key = vertex._dc_key;
            }

            if (normalizedVertex.data) {
                if (normalizedVertex.data.extension) {
                    delete normalizedVertex.data.extension.quantityList;
                    delete normalizedVertex.data.extension.childQuantityList;
                }

                delete normalizedVertex.data.privateData;
                delete normalizedVertex.data.inputEPCList;
                delete normalizedVertex.data.inputQuantityList;

                delete normalizedVertex.data.outputEPCList;
                delete normalizedVertex.data.outputQuantityList;

                for (const key in normalizedVertex.data.quantities) {
                    for (const qkey in normalizedVertex.data.quantities[key].inputs) {
                        delete normalizedVertex.data.quantities[key].inputs[qkey].private;
                    }

                    for (const qkey in normalizedVertex.data.quantities[key].outputs) {
                        delete normalizedVertex.data.quantities[key].outputs[qkey].private;
                    }
                }
            }

            normalizedVertex.uid = vertex.uid;
            normalizedVertex.sender_id = vertex.sender_id;

            normalizedVertex._key = vertex._key;
            normalizedVertex.vertex_type = vertex.vertex_type;
            normalizedVertices.push(normalizedVertex);
        } else {
            delete vertex.datasets;
            normalizedVertices.push(vertex);
        }
    });

    edges.forEach((edge) => {
        if (edge.edge_type !== 'EVENT_CONNECTION') {
            delete edge.datasets;
            delete edge.encrypted;
            normalizedEdges.push(edge);
        }
    });

    return {
        vertices: normalizedVertices,
        edges: normalizedEdges,
    };
}

module.exports = {
    denormalizeGraph,
    normalizeGraph,
};
