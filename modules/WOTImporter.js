const Utilities = require('./Utilities');
const ImportUtilities = require('./ImportUtilities');

const GraphConverter = require('./Database/graph-converter');

/**
 * Web Of Things model importer
 */
class WOTImporter {
    /**
     * Default constructor
     * @param ctx  IoC container
     */
    constructor(ctx) {
        this.db = ctx.graphStorage;
        this.config = ctx.config;
        this.helper = ctx.gs1Utilities;
    }

    static copyProperties(from, to) {
        for (const property in from) {
            to[property] = from[property];
        }
    }

    /**
     * Parse WOT model
     * @param payload   WOT contents
     * @return {Promise<void>}
     */
    async parse(payload) {
        const parsed = JSON.parse(payload);
        const { things, sender } = parsed.data;
        const tmpDataSetId = 'tmp_data_set_id';

        const edges = [];
        const vertices = [];

        for (const thingDesc of things) {
            // eslint-disable-next-line
            const { thingEdges, thingVertices } = await this.parseThingDesc(thingDesc, sender);
            edges.push(...thingEdges);
            vertices.push(...thingVertices);
        }

        const identifiers = [];
        const identifierEdges = [];

        for (const vertex of vertices) {
            if (vertex.identifiers !== null) {
                for (const identifier in vertex.identifiers) {
                    const id_type = identifier;
                    const id_value = vertex.identifiers[id_type];
                    const object_key = vertex._key;
                    const id_key = this.helper.createKey('identifier', sender, id_type, id_value);

                    identifiers.push({
                        _key: id_key,
                        id_type,
                        id_value,
                        vertex_type: 'IDENTIFIER',
                        sender_id: sender.id,
                    });

                    identifierEdges.push({
                        _key: this.helper.createKey('identifies', sender, id_key, vertex.identifiers.uid),
                        _from: id_key,
                        _to: object_key,
                        edge_type: 'IDENTIFIES',
                        sender_id: sender.id,
                    });

                    identifierEdges.push({
                        _key: this.helper.createKey('identified_by', sender, vertex.identifiers.uid, id_key),
                        _from: object_key,
                        _to: id_key,
                        edge_type: 'IDENTIFIED_BY',
                        sender_id: sender.id,
                    });
                }
            }
        }

        vertices.push(...identifiers);
        edges.push(...identifierEdges);

        const { vertices: denormalizedVertices, edges: denormalizedEdges } =
            GraphConverter.denormalizeGraph(
                tmpDataSetId,
                Utilities.copyObject(vertices),
                edges,
            );

        const objectClasses = await this.db.findObjectClassVertices();
        const dataSetId = ImportUtilities.importHash(
            tmpDataSetId,
            denormalizedVertices.concat(objectClasses),
            denormalizedEdges,
        );

        const { vertices: newDenormalizedVertices, edges: newDenormalizedEdges } =
            GraphConverter.denormalizeGraph(
                dataSetId,
                Utilities.copyObject(vertices),
                edges,
            );

        const { vertices: normalizedVertices, edges: normalizedEdges } =
            GraphConverter.normalizeGraph(
                dataSetId,
                Utilities.copyObject(newDenormalizedVertices),
                newDenormalizedEdges,
            );

        await Promise.all(newDenormalizedEdges.map(edge => this.db.addEdge(edge)));
        await Promise.all(newDenormalizedVertices.map(vertex => this.db.addVertex(vertex)));

        await Promise.all(denormalizedVertices.map(vertex => this.db.updateImports('ot_vertices', vertex._key, dataSetId)));
        await Promise.all(denormalizedEdges.map(edge => this.db.updateImports('ot_edges', edge._key, dataSetId)));

        return {
            status: 'success',
            vertices: normalizedVertices,
            edges: normalizedEdges,
            data_set_id: dataSetId,
            wallet: sender.wallet,
        };
    }

    /**
     * Parse single thing description (thing, model, properties, actions, etc.)
     * @param thingDesc
     * @param sender
     * @return {Promise<{thingEdges: Array, thingVertices: Array}>}
     */
    async parseThingDesc(thingDesc, sender) {
        const thingEdges = [];
        const thingVertices = [];

        const {
            thing, model, properties, actions, observedObjects, readPoint,
        } = thingDesc;
        const { id } = thing;
        const senderId = sender.id;

        const actor = {
            identifiers: {
                id,
                uid: id,
            },
            data: {
                model: {},
            },
            vertex_type: 'ACTOR',
        };

        WOTImporter.copyProperties(thing, actor.data);
        WOTImporter.copyProperties(model, actor.data.model);
        delete actor.data.id;

        actor._key = this.helper.createKey('actor', senderId, id);
        thingVertices.push(actor);

        thingEdges.push({
            _key: this.helper.createKey('is', senderId, actor._key, 'Actor'),
            _from: `${actor._key}`,
            _to: 'Actor',
            edge_type: 'IS',
        });
        const eventId = new Date().toISOString();
        const event = {
            identifiers: {
                id: eventId,
                uid: eventId,
            },
            data: {
                object_class_id: 'Observation',
                categories: 'OBSERVE',
                properties,
                actions,
                eventTime: eventId,
            },
            vertex_type: 'EVENT',
        };
        event._key = this.helper.createKey('event', senderId, eventId);
        thingVertices.push(event);

        for (const ooId of observedObjects) {
            const objectKey = this.helper.createKey('batch', senderId, ooId);
            const objectVertex = {
                _key: objectKey,
                identifiers: {
                    id: ooId,
                    uid: ooId,
                },
                data: {
                    note: 'observed object',
                },
                vertex_type: 'BATCH',
            };
            thingVertices.push(objectVertex);

            thingEdges.push({
                _key: this.helper.createKey('event_batch', senderId, event._key, ooId),
                _from: `${event._key}`,
                _to: `${objectVertex._key}`,
                edge_type: 'EVENT_BATCH',
            });
            thingEdges.push({
                _key: this.helper.createKey('event_batch', senderId, ooId, event._key),
                _from: `${objectVertex._key}`,
                _to: `${event._key}`,
                edge_type: 'EVENT_BATCH',
            });
        }

        if (readPoint) {
            const locationKey = this.helper.createKey('location', senderId, readPoint.id);
            const locationVertex = {
                _key: locationKey,
                identifiers: {
                    id: readPoint.id,
                    uid: readPoint.id,
                },
                data: {
                    note: 'read point',
                },
                vertex_type: 'LOCATION',
            };
            thingVertices.push(locationVertex);

            thingEdges.push({
                _key: this.helper.createKey('read_point', senderId, event._key, readPoint.id),
                _from: `${event._key}`,
                _to: `${locationVertex._key}`,
                edge_type: 'READ_POINT',
            });

            thingEdges.push({
                _key: this.helper.createKey('is', senderId, locationKey, 'Location'),
                _from: `${locationKey}`,
                _to: 'Location',
                edge_type: 'IS',
            });
        }

        thingEdges.push({
            _key: this.helper.createKey('observed_by', senderId, event._key, actor._key),
            _from: `${event._key}`,
            _to: `${actor._key}`,
            edge_type: 'OBSERVED_BY',
        });

        thingEdges.push({
            _key: this.helper.createKey('observed', senderId, actor._key, event._key),
            _from: `${actor._key}`,
            _to: `${event._key}`,
            edge_type: 'OBSERVED',
        });

        const addProperties = (elem) => {
            elem.sender_id = senderId;
            return elem;
        };
        thingEdges.map(addProperties);
        thingVertices.map(addProperties);

        return {
            thingEdges,
            thingVertices,
        };
    }
}

module.exports = WOTImporter;
