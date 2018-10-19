
function denormalizeGraph(importId, vertices, edges) {
    const denormalizedVertices = [];
    const denormalizedEdges = [];

    vertices.forEach((vertex) => {
        const denormalizedVertex = {
            [importId]: {},
            // TODO: some R here.
        };

        denormalizedVertex[importId].data = vertex.data;
        denormalizedVertex.uid = vertex.identifiers.uid;
        denormalizedVertex.sender_id = vertex.sender_id;
        denormalizedVertex[importId].private = vertex.private; // TODO: ?
        denormalizedVertex.randomness = vertex.randomness; // TODO: ?
        denormalizedVertex.private_salt = vertex.private_salt; // TODO: ?

        denormalizedVertex._key = vertex._key;
        denormalizedVertex.vertex_type = vertex.vertex_type;
        denormalizedVertices.push(denormalizedVertex);
    });

    return {
        vertices: denormalizedVertices,
        edges: denormalizedEdges,
    };
}

module.exports = {
    denormalizeGraph,
};
