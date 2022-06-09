const validator = require('validator');
const Models = require('../../../models');
const constants = require('../../../modules/constants');
const BaseController = require('./base-controller');

class ResultController extends BaseController {
    async handleHttpApiOperationResultRequest(req, res) {
        if (
            ![
                'provision',
                'update',
                'publish',
                'resolve',
                'query',
                'entities:search',
                'assertions:search',
                'proofs:get',
            ].includes(req.params.operation)
        ) {
            return this.returnResponse(res, 400, {
                code: 400,
                message:
                    'Unexisting operation, available operations are: provision, update, publish, resolve, entities:search, assertions:search, query and proofs:get',
            });
        }

        const { handler_id, operation } = req.params;
        if (!validator.isUUID(handler_id)) {
            return this.returnResponse(res, 400, {
                code: 400,
                message: 'Handler id is in wrong format',
            });
        }

        try {
            const handlerData = await Models.handler_ids.findOne({
                where: {
                    handler_id,
                },
            });

            let response;
            if (handlerData) {
                if (handlerData.status === 'FAILED') {
                    return res.status(200).send({
                        status: handlerData.status,
                        data: JSON.parse(handlerData.data),
                    });
                }
                const documentPath = this.fileService.getHandlerIdDocumentPath(handler_id);
                switch (req.params.operation) {
                    case 'entities:search':
                        if (handlerData && handlerData.status === 'COMPLETED') {
                            handlerData.data = await this.fileService.loadJsonFromFile(
                                documentPath,
                            );
                        } else {
                            handlerData.data = [];
                        }

                        response = handlerData.data.map((x) => ({
                            '@type': 'EntitySearchResult',
                            result: {
                                '@id': x.id,
                                '@type': x.type.toUpperCase(),
                                timestamp: x.timestamp,
                            },
                            issuers: x.issuers,
                            assertions: x.assertions,
                            nodes: x.nodes,
                            resultScore: 0,
                        }));

                        res.send({
                            '@context': {
                                '@vocab': 'http://schema.org/',
                                goog: 'http://schema.googleapis.com/',
                                resultScore: 'goog:resultScore',
                                detailedDescription: 'goog:detailedDescription',
                                EntitySearchResult: 'goog:EntitySearchResult',
                                kg: 'http://g.co/kg',
                            },
                            '@type': 'ItemList',
                            itemCount: response.length,
                            itemListElement: response,
                        });
                        break;
                    case 'assertions:search':
                        if (handlerData && handlerData.status === 'COMPLETED') {
                            handlerData.data = await this.fileService.loadJsonFromFile(
                                documentPath,
                            );
                        } else {
                            handlerData.data = [];
                        }

                        response = handlerData.data.map(async (x) => ({
                            '@type': 'AssertionSearchResult',
                            result: {
                                '@id': x.id,
                                metadata: x.metadata,
                                signature: x.signature,
                                rootHash: x.rootHash,
                            },
                            nodes: x.nodes,
                            resultScore: 0,
                        }));

                        response = await Promise.all(response);

                        res.send({
                            '@context': {
                                '@vocab': 'http://schema.org/',
                                goog: 'http://schema.googleapis.com/',
                                resultScore: 'goog:resultScore',
                                detailedDescription: 'goog:detailedDescription',
                                EntitySearchResult: 'goog:EntitySearchResult',
                                kg: 'http://g.co/kg',
                            },
                            '@type': 'ItemList',
                            itemCount: response.length,
                            itemListElement: response,
                        });
                        break;
                    case 'resolve':
                        if (handlerData && handlerData.status === 'COMPLETED') {
                            handlerData.data = await this.fileService.loadJsonFromFile(
                                documentPath,
                            );
                        }
                        res.status(200).send({
                            status: handlerData.status,
                            data: handlerData.data,
                        });
                        break;
                    case 'provision':
                    case 'publish':
                    case 'update':
                        if (handlerData && handlerData.status === 'COMPLETED') {
                            const result = await this.fileService.loadJsonFromFile(documentPath);
                            delete result.assertion.data;
                            handlerData.data = result.assertion;
                        }
                        res.status(200).send({
                            status: handlerData.status,
                            data: handlerData.data,
                        });
                        break;
                    default:
                        if (handlerData && handlerData.status === 'COMPLETED') {
                            handlerData.data = await this.fileService.loadJsonFromFile(
                                documentPath,
                            );
                        }

                        res.status(200).send({
                            status: handlerData.status,
                            data: handlerData.data,
                        });
                        break;
                }
            } else {
                return this.returnResponse(res, 400, {
                    code: 400,
                    message: `Handler with id: ${handler_id} does not exist.`,
                });
            }
        } catch (e) {
            this.logger.error({
                msg: `Error while trying to fetch ${operation} data for handler id ${handler_id}. Error message: ${e.message}. ${e.stack}`,
                Event_name: constants.ERROR_TYPE.RESULTS_ROUTE_ERROR,
                Event_value1: e.message,
                Id_operation: handler_id,
            });

            return this.returnResponse(res, 400, {
                code: 400,
                message: `Unexpected error at getting results: ${e}`,
            });
        }
    }
}

module.exports = ResultController;
