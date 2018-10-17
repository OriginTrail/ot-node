
function denormalizeGraph(importId, vertices, edges) {
    const denormalizedVertices = [];
    const denormalizedEdges = [];

    vertices.forEach((vertex) => {
        const denormalizedVertex = {
            [importId]: {},
            // TODO: some R here.
        };

        denormalizedVertex[importId].data = vertex.data;
        denormalizedVertex.identifiers = vertex.identifiers;
        denormalizedVertex[importId].sender_id = vertex.sender_id;
        denormalizedVertex[importId].private = vertex.private; // TODO: ?
        denormalizedVertex.randomness = vertex.randomness; // TODO: ?

        denormalizedVertex._key = vertex.identifiers.id;
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
