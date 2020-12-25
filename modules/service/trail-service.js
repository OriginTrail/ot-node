const Utilities = require('../Utilities');
const constants = require('../constants');

class TrailService {
    constructor(ctx) {
        this.graphStorage = ctx.graphStorage;
        this.importService = ctx.importService;
        this.log = ctx.logger;
    }

    async lookupTrail(identifierTypes, identifierValues, opcode) {
        const typesArray = Utilities.arrayze(identifierTypes);
        const valuesArray = Utilities.arrayze(identifierValues);

        if (identifierTypes.length !== identifierValues.length) {
            throw Error('Identifier array length mismatch');
        }

        if (!['EQ', 'IN'].includes(opcode)) {
            throw Error('Invalid opcode parameter. Opcode can be EQ or IN');
        }

        const identifierKeys = [];

        for (let i = 0; i < typesArray.length; i += 1) {
            identifierKeys.push(Utilities.keyFrom(typesArray[i], valuesArray[i]));
        }

        const result = await this.graphStorage.lookupTrail({
            identifierKeys,
            opcode,
        });

        return result;
    }

    async findTrail(
        uniqueIdentifiers, depth, reach,
        includedConnectionTypes,
        excludedConnectionTypes,
    ) {
        if (includedConnectionTypes &&
            excludedConnectionTypes &&
            includedConnectionTypes.find(x => excludedConnectionTypes.includes(x))) {
            throw Error('Included and excluded connection types contain same types');
        }

        const trail =
            await this.graphStorage.findTrail({
                uniqueIdentifiers,
                depth,
                includedConnectionTypes,
                excludedConnectionTypes,
            });

        let response = this.importService.packTrailData(trail);

        if (reach === constants.TRAIL_REACH_PARAMETERS.extended) {
            response = await this._extendResponse(response);
        }

        return response;
    }

    async _extendResponse(response) {
        const missingObjects = {};
        for (const trailElement of response) {
            const object = trailElement.otObject;

            const elementIsMissing =
                (array, element) => !array.find(e => e.otObject['@id'] === element['@id']);

            for (const relation of object.relations) {
                if (missingObjects[relation.linkedObject['@id']] || elementIsMissing(response, relation.linkedObject)) {
                    if (!missingObjects[relation.linkedObject['@id']]) {
                        missingObjects[relation.linkedObject['@id']] = trailElement.datasets;
                    } else {
                        missingObjects[relation.linkedObject['@id']] =
                            [...new Set(missingObjects[relation.linkedObject['@id']], trailElement.datasets)];
                    }
                }
            }
        }

        if (Object.keys(missingObjects).length > 0) {
            /*
              missingObjects: {
                id1: [  dataset 1,  dataset 2, ... ],
                id2: [  dataset 2,  dataset x, ... ],
                ...
              }
             */

            const missingIds = Object.keys(missingObjects);
            const missingElements =
                await this.graphStorage.findTrailExtension(missingIds, missingObjects);

            const trailExtension = this.importService.packTrailData(missingElements);

            return response.concat(trailExtension);
        }

        return response;
    }
}

module.exports = TrailService;
