const fs = require('fs');
const md5 = require('md5');
const Utilities = require('./Utilities');

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
     * @param payload   WOT contents
     * @return {Promise<void>}
     */
    async parse(payload) {
        const parsed = JSON.parse(payload);
        const importId = Utilities.createImportId();
        const { things, sender } = parsed.data;

        const edges = [];
        const vertices = [];

        for (const thingDesc of things) {
            // eslint-disable-next-line
            const { thingEdges, thingVertices } = await this.parseThingDesc(thingDesc, importId, sender);
            edges.push(...thingEdges);
            vertices.push(...thingVertices);
        }

        await Promise.all(edges.map(edge => this.db.addEdge(edge)));
        await Promise.all(vertices.map(vertex => this.db.addVertex(vertex)));
        return {
            status: 'success',
            vertices,
            edges,
            import_id: importId,
            wallet: sender.wallet,
        };
    }

    /**
     * Parse single thing description (thing, model, properties, actions, etc.)
     * @param thingDesc
     * @param importId
     * @param sender
     * @return {Promise<{thingEdges: Array, thingVertices: Array}>}
     */
    async parseThingDesc(thingDesc, importId, sender) {
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

        actor._key = md5(`actor_${senderId}_${JSON.stringify(actor.identifiers)}_${md5(JSON.stringify(actor.data))}`);
        thingVertices.push(actor);

        thingEdges.push({
            _key: md5(`is_${senderId}_${actor._key}_ACTOR`),
            _from: `${actor._key}`,
            _to: 'ACTOR',
            edge_type: 'IS',
        });
        const date = new Date(importId);
        const eventId = `${senderId}:${date.toUTCString()}`.replace(/ /g, '_').replace(/,/g, '');
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
        event._key = md5(`event_${senderId}_${JSON.stringify(event.identifiers)}_${md5(JSON.stringify(event.data))}`);
        thingVertices.push(event);

        for (const ooId of observedObjects) {
            // eslint-disable-next-line
            const ooVertex = await this.db.findVertexWithMaxVersion(senderId, ooId);
            if (ooVertex) {
                thingEdges.push({
                    _key: md5(`event_object_${senderId}_${event._key}_${ooVertex._key}`),
                    _from: `${event._key}`,
                    _to: `${ooVertex._key}`,
                    edge_type: 'EVENT_OBJECT',
                    identifiers: {
                        uid: `event_object_${event.identifiers.id}_${ooVertex.identifiers.id}`,
                    },
                });
                thingEdges.push({
                    _key: md5(`event_object_${senderId}_${ooVertex._key}_${event._key}`),
                    _from: `${ooVertex._key}`,
                    _to: `${event._key}`,
                    edge_type: 'EVENT_OBJECT',
                    identifiers: {
                        uid: `event_object_${ooVertex.identifiers.id}_${event.identifiers.id}`,
                    },
                });
            }
        }

        if (readPoint) {
            const rpVertex = await this.db.findVertexWithMaxVersion(senderId, readPoint.id);
            if (rpVertex) {
                thingEdges.push({
                    _key: md5(`read_point_${senderId}_${event._key}_${rpVertex._key}`),
                    _from: `${event._key}`,
                    _to: `${rpVertex._key}`,
                    edge_type: 'READ_POINT',
                    identifiers: {
                        uid: `read_point_${event.identifiers.id}_${rpVertex.identifiers.id}`,
                    },
                });
            }
        }

        thingEdges.push({
            _key: md5(`observed_by_${senderId}_${event._key}_${actor._key}`),
            _from: `${event._key}`,
            _to: `${actor._key}`,
            edge_type: 'OBSERVED_BY',
            identifiers: {
                uid: `observed_by_${event.identifiers.id}_${actor.identifiers.id}`,
            },
        });

        thingEdges.push({
            _key: md5(`observed_${senderId}_${actor._key}_${event._key}`),
            _from: `${actor._key}`,
            _to: `${event._key}`,
            edge_type: 'OBSERVED',
            identifiers: {
                uid: `observed_${actor.identifiers.id}_${event.identifiers.id}`,
            },
        });

        const addProperties = (elem) => {
            elem.sender_id = senderId;
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
