import Sequelize from 'sequelize';
import {
    OPERATION_ID_STATUS,
    HIGH_TRAFFIC_OPERATIONS_NUMBER_PER_HOUR,
    SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES,
} from '../../../../../constants/constants.js';

class EventRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.event;
    }

    async createEventRecord(
        operationId,
        blockchainId,
        name,
        timestamp,
        value1,
        value2,
        value3,
        options,
    ) {
        return this.model.create(
            {
                operationId,
                blockchainId,
                name,
                timestamp,
                value1,
                value2,
                value3,
            },
            options,
        );
    }

    async getUnpublishedEvents() {
        // events without COMPLETE/FAILED status which are older than 30min
        // are also considered finished
        const minutes = 5;

        let operationIds = await this.model.findAll({
            raw: true,
            attributes: [
                Sequelize.fn('DISTINCT', Sequelize.col('operation_id')),
                Sequelize.col('timestamp'),
            ],
            where: {
                [Sequelize.Op.or]: {
                    name: {
                        [Sequelize.Op.in]: [
                            OPERATION_ID_STATUS.COMPLETED,
                            OPERATION_ID_STATUS.FAILED,
                        ],
                    },
                    timestamp: {
                        [Sequelize.Op.lt]: Sequelize.literal(
                            `(UNIX_TIMESTAMP()*1000 - 1000*60*${minutes})`,
                        ),
                    },
                },
            },
            order: [['timestamp', 'asc']],
            limit:
                Math.floor(HIGH_TRAFFIC_OPERATIONS_NUMBER_PER_HOUR / 60) *
                SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES,
        });

        operationIds = operationIds.map((e) => e.operation_id);

        return this.model.findAll({
            where: {
                operationId: {
                    [Sequelize.Op.in]: operationIds,
                },
            },
        });
    }

    async destroyEvents(ids, options) {
        await this.model.destroy({
            where: {
                id: {
                    [Sequelize.Op.in]: ids,
                },
            },
            ...options,
        });
    }
}

export default EventRepository;
