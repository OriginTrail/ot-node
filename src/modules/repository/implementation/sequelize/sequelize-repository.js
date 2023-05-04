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
        await connection
            .promise()
            .query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\`;`);
    }

    async dropDatabase() {
        const connection = await mysql.createConnection({
            host: process.env.SEQUELIZE_REPOSITORY_HOST,
            port: process.env.SEQUELIZE_REPOSITORY_PORT,
            user: process.env.SEQUELIZE_REPOSITORY_USER,
            password: process.env.SEQUELIZE_REPOSITORY_PASSWORD,
        });
        await connection.promise().query(`DROP DATABASE IF EXISTS \`${this.config.database}\`;`);
    }

    async runMigrations() {
        const migrator = createMigrator(this.models.sequelize, this.config, this.logger);
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
        return this.models.operation_ids.create(handlerData);
    }

    async getOperationIdRecord(operationId) {
        return this.models.operation_ids.findOne({
            where: {
                operation_id: operationId,
            },
        });
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

    async getOperationResponsesStatuses(operation, operationId) {
        return this.models[`${operation}_response`].findAll({
            attributes: ['status', 'keyword'],
            where: {
                operation_id: operationId,
            },
        });
    }

    // Sharding Table
    async createManyPeerRecords(peers) {
        return this._bulkUpdatePeerRecords(peers, ['ask', 'stake', 'sha256']);
    }

    async _bulkUpdatePeerRecords(peerRecords, updateColumns) {
        return this.models.shard.bulkCreate(
            peerRecords.map((peerRecord) => ({
                ask: 0,
                stake: 0,
                sha256: '',
                ...peerRecord,
            })),
            {
                validate: true,
                updateOnDuplicate: updateColumns,
            },
        );
    }

    async removeShardingTablePeerRecords(blockchain) {
        return this.models.shard.destroy({
            where: { blockchain_id: blockchain },
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

    async getAllPeerRecords(blockchain, filterLastSeen) {
        const query = {
            where: {
                blockchain_id: {
                    [Sequelize.Op.eq]: blockchain,
                },
            },
            raw: true,
        };

        if (filterLastSeen) {
            query.where.last_seen = {
                [Sequelize.Op.gte]: Sequelize.col('last_dialed'),
            };
        }

        return this.models.shard.findAll(query);
    }

    async getPeerRecord(peerId, blockchain) {
        return this.models.shard.findOne({
            where: {
                blockchain_id: {
                    [Sequelize.Op.eq]: blockchain,
                },
                peer_id: {
                    [Sequelize.Op.eq]: peerId,
                },
            },
            raw: true,
        });
    }

    async getPeersCount(blockchain) {
        return this.models.shard.count({
            where: {
                blockchain_id: blockchain,
            },
        });
    }

    async getPeersToDial(limit, dialFrequencyMillis) {
        return this.models.shard.findAll({
            attributes: ['peer_id'],
            where: {
                last_dialed: {
                    [Sequelize.Op.lt]: new Date(Date.now() - dialFrequencyMillis),
                },
            },
            order: [['last_dialed', 'asc']],
            limit,
            raw: true,
        });
    }

    async updatePeersAsk(peerRecords) {
        return this._bulkUpdatePeerRecords(peerRecords, ['ask']);
    }

    async updatePeersStake(peerRecords) {
        return this._bulkUpdatePeerRecords(peerRecords, ['stake']);
    }

    async updatePeerRecordLastDialed(peerId, timestamp) {
        await this.models.shard.update(
            {
                last_dialed: timestamp,
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp) {
        await this.models.shard.update(
            {
                last_dialed: timestamp,
                last_seen: timestamp,
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async removePeerRecords(peerRecords) {
        await this.models.shard.bulkDestroy(peerRecords);
    }

    async cleanShardingTable(blockchainId) {
        await this.models.shard.destroy({
            where: blockchainId ? { blockchain_id: blockchainId } : {},
        });
    }

    async getLastCheckedBlock(blockchainId, contract) {
        return this.models.blockchain.findOne({
            attributes: ['last_checked_block', 'last_checked_timestamp'],
            where: { blockchain_id: blockchainId, contract },
            raw: true,
        });
    }

    async removeLastCheckedBlockForContract(contract) {
        return this.models.blockchain.destroy({
            where: {
                contract,
            },
        });
    }

    async updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract) {
        return this.models.blockchain.upsert({
            blockchain_id: blockchainId,
            contract,
            last_checked_block: currentBlock,
            last_checked_timestamp: timestamp,
        });
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

    async query(query) {
        return this.models.sequelize.query(query);
    }

    async insertBlockchainEvents(events) {
        const inserted = await this.models.blockchain_event.bulkCreate(
            events.map((event) => ({
                contract: event.contract,
                event: event.event,
                data: event.data,
                block: event.block,
                blockchain_id: event.blockchainId,
                processed: false,
            })),
            {
                ignoreDuplicates: true,
            },
        );
        return inserted.map((event) => event.dataValues);
    }

    async getAllUnprocessedBlockchainEvents(eventNames) {
        return this.models.blockchain_event.findAll({
            where: {
                processed: false,
                event: { [Sequelize.Op.in]: eventNames },
            },
            order: [['block', 'asc']],
        });
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

    async markBlockchainEventsAsProcessed(events) {
        const idsForUpdate = events.map((event) => event.id);
        return this.models.blockchain_event.update(
            { processed: true },
            {
                where: { id: { [Sequelize.Op.in]: idsForUpdate } },
            },
        );
    }

    async updateServiceAgreementRecord(
        blockchainId,
        contract,
        tokenId,
        agreementId,
        startTime,
        epochsNumber,
        epochLength,
        scoreFunctionId,
        proofWindowOffsetPerc,
        hashFunctionId,
        keyword,
        assertionId,
        stateIndex,
        lastCommitEpoch,
        lastProofEpoch,
    ) {
        return this.models.service_agreement.upsert({
            blockchain_id: blockchainId,
            asset_storage_contract_address: contract,
            token_id: tokenId,
            agreement_id: agreementId,
            start_time: startTime,
            epochs_number: epochsNumber,
            epoch_length: epochLength,
            score_function_id: scoreFunctionId,
            proof_window_offset_perc: proofWindowOffsetPerc,
            hash_function_id: hashFunctionId,
            keyword,
            assertion_id: assertionId,
            state_index: stateIndex,
            last_commit_epoch: lastCommitEpoch,
            last_proof_epoch: lastProofEpoch,
        });
    }

    async updateServiceAgreementLastCommitEpoch(blockchainId, contract, tokenId, lastCommitEpoch) {
        return this.models.service_agreement.update(
            { last_commit_epoch: lastCommitEpoch },
            {
                where: {
                    blockchain_id: blockchainId,
                    asset_storage_contract_address: contract,
                    token_id: tokenId,
                },
            },
        );
    }

    async updateServiceAgreementLastProofEpoch(blockchainId, contract, tokenId, lastProofEpoch) {
        return this.models.service_agreement.update(
            { last_proof_epoch: lastProofEpoch },
            {
                where: {
                    blockchain_id: blockchainId,
                    asset_storage_contract_address: contract,
                    token_id: tokenId,
                },
            },
        );
    }

    async removeServiceAgreementRecord(blockchainId, contract, tokenId) {
        await this.models.service_agreement.destroy({
            where: {
                blockchain_id: blockchainId,
                asset_storage_contract_address: contract,
                token_id: tokenId,
            },
        });
    }

    getEligibleAgreementsForSubmitCommit(timestampSeconds, blockchain, commitWindowDurationPerc) {
        const currentEpoch = `FLOOR((${timestampSeconds} - start_time) / epoch_length)`;
        const currentEpochPerc = `((${timestampSeconds} - start_time) % epoch_length) / epoch_length * 100`;

        return this.models.service_agreement.findAll({
            attributes: {
                include: [
                    [Sequelize.literal(currentEpoch), 'current_epoch'],
                    [
                        Sequelize.cast(
                            Sequelize.literal(`${commitWindowDurationPerc} - ${currentEpochPerc}`),
                            'DOUBLE',
                        ),
                        'time_left_in_submit_commit_window',
                    ],
                ],
            },
            where: {
                blockchain_id: blockchain,
                [Sequelize.Op.or]: [
                    {
                        last_commit_epoch: {
                            [Sequelize.Op.is]: null,
                        },
                    },
                    {
                        last_commit_epoch: {
                            [Sequelize.Op.lt]: Sequelize.literal(currentEpoch),
                        },
                    },
                ],
                [Sequelize.Op.and]: Sequelize.literal(
                    `${currentEpochPerc} <= ${commitWindowDurationPerc}`,
                ),
                epochs_number: {
                    [Sequelize.Op.gt]: Sequelize.literal(currentEpoch),
                },
            },
            order: [[Sequelize.col('time_left_in_submit_commit_window'), 'ASC']],
            limit: 10, // TODO: review this
            raw: true,
        });
    }

    async getEligibleAgreementsForSubmitProof(
        timestampSeconds,
        blockchain,
        proofWindowDurationPerc,
    ) {
        const currentEpoch = `FLOOR((${timestampSeconds} - start_time) / epoch_length)`;
        const currentEpochPerc = `((${timestampSeconds} - start_time) % epoch_length) / epoch_length * 100`;

        return this.models.service_agreement.findAll({
            attributes: {
                include: [
                    [Sequelize.literal(currentEpoch), 'current_epoch'],
                    [
                        Sequelize.cast(
                            Sequelize.literal(
                                `proof_window_offset_perc + ${proofWindowDurationPerc} - ${currentEpochPerc}`,
                            ),
                            'DOUBLE',
                        ),
                        'time_left_in_submit_proof_window',
                    ],
                ],
            },
            where: {
                blockchain_id: blockchain,
                last_commit_epoch: {
                    [Sequelize.Op.eq]: Sequelize.literal(currentEpoch),
                },
                [Sequelize.Op.or]: [
                    {
                        last_proof_epoch: {
                            [Sequelize.Op.is]: null,
                        },
                    },
                    {
                        last_proof_epoch: {
                            [Sequelize.Op.lt]: Sequelize.literal(currentEpoch),
                        },
                    },
                ],
                [Sequelize.Op.and]: [
                    Sequelize.literal(`${currentEpochPerc} >= proof_window_offset_perc`),
                    Sequelize.literal(
                        `${currentEpochPerc} <= proof_window_offset_perc + ${proofWindowDurationPerc}`,
                    ),
                ],
                epochs_number: {
                    [Sequelize.Op.gt]: Sequelize.literal(currentEpoch),
                },
            },
            order: [[Sequelize.col('time_left_in_submit_proof_window'), 'ASC']],
            limit: 10, // TODO: review this
            raw: true,
        });
    }

    async destroyAllRecords(table) {
        return this.models[table].destroy({ where: {} });
    }
}

export default SequelizeRepository;
