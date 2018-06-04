const fs = require('fs');
const md5 = require('md5');

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
    }

    static copyProperties(from, to) {
        for (const property in from) {
            to[property] = from[property];
        }
    }

    /**
     * Parse WOT model
     * @param payloadFile   WOT description
     * @return {Promise<void>}
     */
    async parse(payloadFile) {
        const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'));
        const importId = Date.now();
        const { things, sender } = payload.data;

        const edges = [];
        const vertices = [];

        for (const thingDesc of things) {
            // eslint-disable-next-line
            const { thingEdges, thingVertices } = await this.parseThingDesc(thingDesc, sender, importId);
            edges.push(...thingEdges);
            vertices.push(...thingVertices);
        }

        await Promise.all(edges.map(edge => this.db.addEdge(edge)));
        await Promise.all(vertices.map(vertex => this.db.addVertex(vertex)));
        return { vertices, edges, import_id: importId };
    }

    /**
     * Parse single thing description (thing, model, properties, actions, etc.)
     * @param thingDesc
     * @param sender
     * @param importId
     * @return {Promise<{thingEdges: Array, thingVertices: Array}>}
     */
    async parseThingDesc(thingDesc, sender, importId) {
        const thingEdges = [];
        const thingVertices = [];

        const {
            thing, model, properties, actions, observedObjects, readPoint,
        } = thingDesc;
        const { id } = thing;

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

        actor._key = md5(`actor_${sender.id}_${JSON.stringify(actor.identifiers)}_${md5(JSON.stringify(actor.data))}`);
        thingVertices.push(actor);

        thingEdges.push({
            _key: md5(`is_${sender.id}_${actor._key}_ACTOR`),
            _from: `ot_vertices/${actor._key}`,
            _to: 'ot_vertices/ACTOR',
            edge_type: 'IS',
        });

        const date = new Date(importId);
        const eventId = `${sender.id}:${date.toUTCString()}`.replace(/ /g, '_').replace(/,/g, '');
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
            },
            vertex_type: 'EVENT',
        };
        event._key = md5(`event_${sender.id}_${JSON.stringify(event.identifiers)}_${md5(JSON.stringify(event.data))}`);
        thingVertices.push(event);

        for (const ooId of observedObjects) {
            // eslint-disable-next-line
            const ooVertex = await this.db.findVertexWithMaxVersion(sender.id, ooId);
            if (ooVertex) {
                thingEdges.push({
                    _key: md5(`event_object_${sender.id}_${event._key}_${ooVertex._key}`),
                    _from: `ot_vertices/${event._key}`,
                    _to: `ot_vertices/${ooVertex._key}`,
                    edge_type: 'EVENT_OBJECT',
                    identifiers: {
                        uid: `event_object_${event.identifiers.id}_${ooVertex.identifiers.id}`,
                    },
                });
                thingEdges.push({
                    _key: md5(`event_object_${sender.id}_${ooVertex._key}_${event._key}`),
                    _from: `ot_vertices/${ooVertex._key}`,
                    _to: `ot_vertices/${event._key}`,
                    edge_type: 'EVENT_OBJECT',
                    identifiers: {
                        uid: `event_object_${ooVertex.identifiers.id}_${event.identifiers.id}`,
                    },
                });
            }
        }

        if (readPoint) {
            const rpVertex = await this.db.findVertexWithMaxVersion(sender.id, readPoint.id);
            if (rpVertex) {
                thingEdges.push({
                    _key: md5(`read_point_${sender.id}_${event._key}_${rpVertex._key}`),
                    _from: `ot_vertices/${event._key}`,
                    _to: `ot_vertices/${rpVertex._key}`,
                    edge_type: 'READ_POINT',
                    identifiers: {
                        uid: `read_point_${event.identifiers.id}_${rpVertex.identifiers.id}`,
                    },
                });
            }
        }

        thingEdges.push({
            _key: md5(`observed_by_${sender.id}_${event._key}_${actor._key}`),
            _from: `ot_vertices/${event._key}`,
            _to: `ot_vertices/${actor._key}`,
            edge_type: 'OBSERVED_BY',
            identifiers: {
                uid: `observed_by_${event.identifiers.id}_${actor.identifiers.id}`,
            },
        });

        thingEdges.push({
            _key: md5(`observed_${sender.id}_${actor._key}_${event._key}`),
            _from: `ot_vertices/${actor._key}`,
            _to: `ot_vertices/${event._key}`,
            edge_type: 'OBSERVED',
            identifiers: {
                uid: `observed_${actor.identifiers.id}_${event.identifiers.id}`,
            },
        });

        const addProperties = (elem) => {
            elem.sender_id = sender.id;
            if (elem.imports) {
                elem.imports.push(importId);
            } else {
                elem.imports = [importId];
            }
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
