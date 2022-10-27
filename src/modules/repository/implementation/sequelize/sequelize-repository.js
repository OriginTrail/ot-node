import mysql from 'mysql2';
import path from 'path';
import fs from 'fs';
import Sequelize from 'sequelize';
import { fileURLToPath } from 'url';
import {
    OPERATION_ID_STATUS,
    HIGH_TRAFFIC_OPERATIONS_NUMBER_PER_HOUR,
    SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES,
} from '../../../../constants/constants.js';
import createMigrator from './sequelize-migrator.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

class SequelizeRepository {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.setEnvParameters();
        await this.createDatabaseIfNotExists();
        this.initializeSequelize();
        await this.runMigrations();
        await this.loadModels();
    }

    initializeSequelize() {
        this.config.define = {
            timestamps: false,
            freezeTableName: true,
        };
        const sequelize = new Sequelize(
            process.env.SEQUELIZE_REPOSITORY_DATABASE,
            process.env.SEQUELIZE_REPOSITORY_USER,
            process.env.SEQUELIZE_REPOSITORY_PASSWORD,
            this.config,
        );
        this.models = { sequelize, Sequelize };
    }

    setEnvParameters() {
        process.env.SEQUELIZE_REPOSITORY_USER = this.config.user;
        process.env.SEQUELIZE_REPOSITORY_PASSWORD =
            process.env.REPOSITORY_PASSWORD ?? this.config.password;
        process.env.SEQUELIZE_REPOSITORY_DATABASE = this.config.database;
        process.env.SEQUELIZE_REPOSITORY_HOST = this.config.host;
        process.env.SEQUELIZE_REPOSITORY_PORT = this.config.port;
        process.env.SEQUELIZE_REPOSITORY_DIALECT = this.config.dialect;
    }

    async createDatabaseIfNotExists() {
        const connection = await mysql.createConnection({
            host: process.env.SEQUELIZE_REPOSITORY_HOST,
            port: process.env.SEQUELIZE_REPOSITORY_PORT,
            user: process.env.SEQUELIZE_REPOSITORY_USER,
            password: process.env.SEQUELIZE_REPOSITORY_PASSWORD,
        });
        // todo remove drop!!!
        // await connection.promise().query(`DROP DATABASE IF EXISTS \`${this.config.database}\`;`);
        await connection
            .promise()
            .query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\`;`);
    }

    async runMigrations() {
        const migrator = createMigrator(this.models.sequelize, this.config);
        await migrator.up();
    }

    async loadModels() {
        const modelsDirectory = path.join(__dirname, 'models');
        // disable automatic timestamps
        const files = (await fs.promises.readdir(modelsDirectory)).filter(
            (file) => file.indexOf('.') !== 0 && file.slice(-3) === '.js',
        );
        for (const file of files) {
            // eslint-disable-next-line no-await-in-loop
            const { default: f } = await import(`./models/${file}`);
            const model = f(this.models.sequelize, Sequelize.DataTypes);
            this.models[model.name] = model;
        }

        Object.keys(this.models).forEach((modelName) => {
            if (this.models[modelName].associate) {
                this.models[modelName].associate(this.models);
            }
        });
    }

    transaction(execFn) {
        return this.models.sequelize.transaction(async (t) => execFn(t));
    }

    // COMMAND
    async updateCommand(update, opts) {
        await this.models.commands.update(update, opts);
    }

    async destroyCommand(name) {
        await this.models.commands.destroy({
            where: {
                name: { [Sequelize.Op.eq]: name },
            },
        });
    }

    async createCommand(command, opts) {
        return this.models.commands.create(command, opts);
    }

    async getCommandsWithStatus(statusArray, excludeNameArray) {
        return this.models.commands.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: statusArray,
                },
                name: { [Sequelize.Op.notIn]: excludeNameArray },
            },
        });
    }

    async getCommandWithId(id) {
        return this.models.commands.findOne({
            where: {
                id,
            },
        });
    }

    async removeFinalizedCommands(finalizedStatuses) {
        await this.models.commands.destroy({
            where: {
                status: { [Sequelize.Op.in]: finalizedStatuses },
                started_at: { [Sequelize.Op.lte]: Date.now() },
            },
        });
    }

    // OPERATION_ID
    async createOperationIdRecord(handlerData) {
        const handlerRecord = await this.models.operation_ids.create(handlerData);
        return handlerRecord;
    }

    async getOperationIdRecord(operationId) {
        const handlerRecord = await this.models.operation_ids.findOne({
            where: {
                operation_id: operationId,
            },
        });
        return handlerRecord;
    }

    async updateOperationIdRecord(data, operationId) {
        await this.models.operation_ids.update(data, {
            where: {
                operation_id: operationId,
            },
        });
    }

    async removeOperationIdRecord(timeToBeDeleted, statuses) {
        await this.models.operation_ids.destroy({
            where: {
                timestamp: { [Sequelize.Op.lt]: timeToBeDeleted },
                status: { [Sequelize.Op.in]: statuses },
            },
        });
    }

    async getNumberOfNodesFoundForPublish(publishId) {
        return this.models.publish.findOne({
            attributes: ['nodes_found'],
            where: {
                id: publishId,
            },
        });
    }

    async createOperationRecord(operation, operationId, status) {
        return this.models[operation].create({
            operation_id: operationId,
            status,
        });
    }

    async getOperationStatus(operation, operationId) {
        return this.models[operation].findOne({
            attributes: ['status'],
            where: {
                operation_id: operationId,
            },
        });
    }

    async updateOperationStatus(operation, operationId, status) {
        await this.models[operation].update(
            { status },
            {
                where: {
                    operation_id: operationId,
                },
            },
        );
    }

    async createOperationResponseRecord(status, operation, operationId, keyword, message) {
        await this.models[`${operation}_response`].create({
            status,
            message,
            operation_id: operationId,
            keyword,
        });
    }

    async getNumberOfOperationResponses(operation, operationId) {
        return this.models[`${operation}_response`].count({
            where: {
                operation_id: operationId,
            },
        });
    }

    async getOperationResponsesStatuses(operation, operationId) {
        return this.models[`${operation}_response`].findAll({
            attributes: ['status', 'keyword'],
            where: {
                operation_id: operationId,
            },
        });
    }

    async countOperationResponseStatuses(operation, operationId) {
        return this.models[`${operation}_response`].findAll({
            attributes: [
                'status',
                [Sequelize.fn('COUNT', Sequelize.col('status')), 'count_status'],
            ],
            group: 'status',
            where: {
                operation_id: operationId,
            },
        });
    }

    // Sharding Table
    async createManyPeerRecords(peers) {
        return this.models.shard.bulkCreate(peers, {
            ignoreDuplicates: true,
        });
    }

    async createPeerRecord(peerId, blockchain, ask, stake, lastSeen, sha256) {
        return this.models.shard.create(
            {
                peer_id: peerId,
                blockchain_id: blockchain,
                ask,
                stake,
                last_seen: lastSeen,
                sha256,
            },
            {
                ignoreDuplicates: true,
            },
        );
    }

    async getAllPeerRecords(blockchain) {
        return this.models.shard.findAll({
            where: {
                blockchain_id: {
                    [Sequelize.Op.eq]: blockchain,
                },
            },
            raw: true,
        });
    }

    async getPeersToDial(limit) {
        return this.models.shard.findAll({
            attributes: ['peer_id'],
            order: [['last_dialed', 'asc']],
            limit,
            raw: true,
        });
    }

    async updatePeerAsk(peerId, ask) {
        await this.models.shard.update(
            {
                ask,
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async updatePeerStake(peerId, stake) {
        await this.models.shard.update(
            {
                stake,
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async updatePeerRecordLastDialed(peerId) {
        await this.models.shard.update(
            {
                last_dialed: new Date(),
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId) {
        await this.models.shard.update(
            {
                last_dialed: new Date(),
                last_seen: new Date(),
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async removePeerRecord(peerId) {
        await this.models.shard.destroy({
            where: {
                peer_id: peerId,
            },
        });
    }

    async updatePeerLastSeen(peerId, lastSeen) {
        await this.models.shard.update(
            { last_seen: lastSeen },
            {
                where: { peer_id: peerId },
            },
        );
    }

    // EVENT
    async createEventRecord(operationId, name, timestamp, value1, value2, value3) {
        return this.models.event.create({
            operation_id: operationId,
            name,
            timestamp,
            value1,
            value2,
            value3,
        });
    }

    async getUnpublishedEvents() {
        // events without COMPLETE/FAILED status which are older than 30min
        // are also considered finished
        const minutes = 5;

        let operationIds = await this.models.event.findAll({
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

        return this.models.event.findAll({
            where: {
                operation_id: {
                    [Sequelize.Op.in]: operationIds,
                },
            },
        });
    }

    async destroyEvents(ids) {
        await this.models.event.destroy({
            where: {
                id: {
                    [Sequelize.Op.in]: ids,
                },
            },
        });
    }

    async getUser(username) {
        return this.models.user.findOne({
            where: {
                name: username,
            },
        });
    }

    async saveToken(tokenId, userId, tokenName, expiresAt) {
        return this.models.token.create({
            id: tokenId,
            user_id: userId,
            expires_at: expiresAt,
            name: tokenName,
        });
    }

    async isTokenRevoked(tokenId) {
        const token = await this.models.token.findByPk(tokenId);

        return token && token.revoked;
    }

    async getTokenAbilities(tokenId) {
        const abilities = await this.models.sequelize.query(
            `SELECT a.name FROM token t
                INNER JOIN user u ON t.user_id = u.id
                INNER JOIN role r ON u.role_id = u.id
                INNER JOIN role_ability ra on r.id = ra.role_id
                INNER JOIN ability a on ra.ability_id = a.id
                WHERE t.id=$tokenId;`,
            { bind: { tokenId }, type: Sequelize.QueryTypes.SELECT },
        );

        return abilities.map((e) => e.name);
    }

    async insertBlockchainEvents(blockchainEvents) {
        const insertPromises = [];
        for (const event of blockchainEvents) {
            insertPromises.push(
                new Promise((resolve, reject) => {
                    this.blockchainEventExists(
                        event.contract,
                        event.event,
                        event.data,
                        event.block,
                        event.blockchainId,
                    )
                        .then(async (exists) => {
                            if (!exists) {
                                await this.models.blockchain_event
                                    .create({
                                        contract: event.contract,
                                        event: event.event,
                                        data: event.data,
                                        block: event.block,
                                        blockchain_id: event.blockchainId,
                                        processed: 0,
                                    })
                                    .then((result) => resolve(result));
                            }
                            resolve(null);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                }),
            );
        }
        return Promise.all(insertPromises);
    }

    async blockchainEventExists(contract, event, data, block, blockchainId) {
        const dbEvent = await this.models.blockchain_event.findOne({
            where: {
                contract,
                event,
                data,
                block,
                blockchain_id: blockchainId,
            },
        });
        return !!dbEvent;
    }

    async markBlockchainEventAsProcessed(
        id,
        contract = null,
        event = null,
        data = null,
        block = null,
        blockchainId = null,
    ) {
        let condition;
        if (id) {
            condition = {
                where: {
                    id,
                },
            };
        } else {
            condition = {
                where: {
                    contract,
                    event,
                    data,
                    block,
                    blockchain_id: blockchainId,
                },
            };
        }
        return this.models.blockchain_event.update({ processed: true }, condition);
    }

    async getLastEvent(contractName, blockchainId) {
        return this.models.blockchain_event.findOne({
            where: {
                contract: contractName,
                blockchain_id: blockchainId,
            },
            order: [['block', 'DESC']],
        });
    }
}

export default SequelizeRepository;
