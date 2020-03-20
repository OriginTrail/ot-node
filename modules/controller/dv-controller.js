const uuidv4 = require('uuid/v4');
const Models = require('../../models');

/**
 * Encapsulates DV related methods
 */
class DVController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
        this.remoteControl = ctx.remoteControl;
        this.emitter = ctx.emitter;

        this.mapping_standards_for_event = new Map();
        this.mapping_standards_for_event.set('ot-json', 'ot-json');
        this.mapping_standards_for_event.set('gs1-epcis', 'gs1');
        this.mapping_standards_for_event.set('graph', 'ot-json');
        this.mapping_standards_for_event.set('wot', 'wot');
    }

    /**
     * Sends query to the network.
     * @param query Query
     * @returns {Promise<*>}
     */
    async queryNetwork(query, response) {
        this.logger.info(`Query handling triggered with ${JSON.stringify(query)}.`);

        const queryId = uuidv4();

        try {
            await this.commandExecutor.add({
                name: 'dvQueryNetworkCommand',
                delay: 0,
                data: {
                    queryId,
                    query,
                },
                transactional: false,
            });
        } catch (error) {
            this.logger.error(`Failed query network. ${error}.`);
            response.status(400);
            response.send({
                message: error.message,
            });
            return;
        }

        return queryId;
    }

    async handleNetworkQueryStatus(id, response) {
        this.logger.info(`Query of network status triggered with ID ${id}`);
        try {
            const networkQuery = await Models.network_queries.find({ where: { id } });
            response.status(200);
            response.send({
                status: networkQuery.status,
                query_id: networkQuery.id,
            });
        } catch (error) {
            console.log(error);
            response.status(400);
            response.send({
                error: `Fail to process network query status for ID ${id}.`,
            });
        }
    }

    async getNetworkQueryResponses(query_id, response) {
        this.logger.info(`Query for network response triggered with query ID ${query_id}`);

        let responses = await Models.network_query_responses.findAll({
            where: {
                query_id,
            },
        });

        responses = responses.map(response => ({
            datasets: JSON.parse(response.data_set_ids),
            stake_factor: response.stake_factor,
            reply_id: response.reply_id,
            node_id: response.node_id,
        }));

        response.status(200);
        response.send(responses);
    }

    /**
     * Handles data read request
     * @param queryId
     * @param dataSetId
     * @param replyId
     */
    async handleDataReadRequest(data_set_id, reply_id, res) {
        this.logger.info(`Choose offer triggered with reply ID ${reply_id} and import ID ${data_set_id}`);

        const offer = await Models.network_query_responses.findOne({
            where: {
                reply_id,
            },
        });

        if (offer == null) {
            res.status(400);
            res.send({ message: 'Reply not found' });
            return;
        }
        try {
            const dataInfo = await Models.data_info.findOne({
                where: { data_set_id },
            });
            if (dataInfo) {
                const message = `I've already stored data for data set ID ${data_set_id}.`;
                this.logger.trace(message);
                res.status(200);
                res.send({ message });
                return;
            }
            const handler_data = {
                data_set_id,
                reply_id,
            };
            const inserted_object = await Models.handler_ids.create({
                status: 'PENDING',
                data: JSON.stringify(handler_data),
            });

            this.logger.info(`Read offer for query ${offer.query_id} with handler id ${inserted_object.dataValues.handler_id} initiated.`);
            this.remoteControl.offerInitiated(`Read offer for query ${offer.query_id} with handler id ${inserted_object.dataValues.handler_id} initiated.`);

            res.status(200);
            res.send({
                handler_id: inserted_object.dataValues.handler_id,
            });

            this.commandExecutor.add({
                name: 'dvDataReadRequestCommand',
                delay: 0,
                data: {
                    dataSetId: data_set_id,
                    replyId: reply_id,
                    handlerId: inserted_object.dataValues.handler_id,
                },
                transactional: false,
            });
        } catch (e) {
            const message = `Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${e}.`;
            res.status(400);
            res.send({ message });
        }
    }

    /**
     * Handles data read request
     * @param queryId
     * @param dataSetId
     * @param replyId
     */
    async handleDataReadExportRequest(req, res) {
        this.logger.api('POST: Network read and export request received.');

        if (req.body == null || req.body.reply_id == null
            || req.body.data_set_id == null) {
            res.status(400);
            res.send({ message: 'Params reply_id, data_set_id are required.' });
            return;
        }
        const { reply_id, data_set_id } = req.body;
        let { standard_id } = req.body;
        if (!standard_id) {
            standard_id = 'ot-json';
        }
        this.logger.info(`Choose offer triggered with reply ID ${reply_id} and import ID ${data_set_id}`);

        const offer = await Models.network_query_responses.findOne({
            where: {
                reply_id,
            },
        });

        if (offer == null) {
            res.status(400);
            res.send({ message: 'Reply not found' });
            return;
        }
        try {
            const standard = this.mapping_standards_for_event.get(standard_id.toLowerCase());
            if (!standard) {
                res.status(400);
                res.send({
                    message: `Standard ID not supported. Supported IDs: ${this.mapping_standards_for_event.keys()}`,
                });
                return;
            }
            const handler_data = {
                data_set_id,
                reply_id,
                standard_id: standard,
                export_status: 'PENDING',
                import_status: 'PENDING',
                readExport: true,
            };
            const inserted_object = await Models.handler_ids.create({
                status: 'PENDING',
                data: JSON.stringify(handler_data),
            });

            const dataInfo = await Models.data_info.findOne({
                where: { data_set_id },
            });
            if (dataInfo) {
                handler_data.import_status = 'COMPLETED';
                await Models.handler_ids.update(
                    {
                        data: JSON.stringify(handler_data),
                    },
                    {
                        where: {
                            handler_id: inserted_object.handler_id,
                        },
                    },
                );

                const commandSequence = [
                    'exportDataCommand',
                    'exportWorkerCommand',
                ];

                await this.commandExecutor.add({
                    name: commandSequence[0],
                    sequence: commandSequence.slice(1),
                    delay: 0,
                    data: {
                        handlerId: inserted_object.handler_id,
                        datasetId: data_set_id,
                        standardId: standard,
                    },
                    transactional: false,
                });
            } else {
                this.logger.info(`Read offer for query ${offer.query_id} with handler id ${inserted_object.dataValues.handler_id} initiated.`);
                this.remoteControl.offerInitiated(`Read offer for query ${offer.query_id} with handler id ${inserted_object.dataValues.handler_id} initiated.`);


                this.commandExecutor.add({
                    name: 'dvDataReadRequestCommand',
                    delay: 0,
                    data: {
                        dataSetId: data_set_id,
                        replyId: reply_id,
                        handlerId: inserted_object.dataValues.handler_id,
                    },
                    transactional: false,
                });
            }

            res.status(200);
            res.send({
                handler_id: inserted_object.dataValues.handler_id,
            });
        } catch (e) {
            const message = `Failed to handle offer ${offer.id} for query ${offer.query_id} handled. ${e}.`;
            res.status(400);
            res.send({ message });
        }
    }

    async handleDataLocationResponse(message) {
        const queryId = message.id;

        // Find the query.
        const networkQuery = await Models.network_queries.findOne({
            where: { id: queryId },
        });

        if (!networkQuery) {
            throw Error(`Didn't find query with ID ${queryId}.`);
        }

        if (networkQuery.status !== 'OPEN') {
            throw Error('Too late. Query closed.');
        }

        await this.commandExecutor.add({
            name: 'dvDataLocationResponseCommand',
            delay: 0,
            data: {
                queryId,
                wallet: message.wallet,
                nodeId: message.nodeId,
                imports: message.imports,
                dataPrice: message.dataPrice,
                dataSize: message.dataSize,
                stakeFactor: message.stakeFactor,
                replyId: message.replyId,
            },
            transactional: false,
        });
    }

    async handleDataReadResponseFree(message) {
        // Is it the chosen one?
        const replyId = message.id;

        // Find the particular reply.
        const networkQueryResponse = await Models.network_query_responses.findOne({
            where: { reply_id: replyId },
        });

        if (!networkQueryResponse) {
            throw Error(`Didn't find query reply with ID ${replyId}.`);
        }
        await this.commandExecutor.add({
            name: 'dvDataReadResponseFreeCommand',
            delay: 0,
            data: {
                message,
            },
            transactional: false,
        });
    }
}

module.exports = DVController;

