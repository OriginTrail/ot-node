import mysql from 'mysql2';
import path from 'path';
import fs from 'fs';
import Sequelize from 'sequelize';
import { fileURLToPath } from 'url';
import createMigrator from './sequelize-migrator.js';
import BlockchainEventRepository from './repositories/blockchain-event-repository.js';
import BlockchainRepository from './repositories/blockchain-repository.js';
import CommandRepository from './repositories/command-repository.js';
import EventRepository from './repositories/event-repository.js';
import OperationIdRepository from './repositories/operation-id-repository.js';
import OperationRepository from './repositories/operation-repository.js';
import OperationResponseRepository from './repositories/operation-response.js';
import ServiceAgreementRepository from './repositories/service-agreement-repository.js';
import ShardRepository from './repositories/shard-repository.js';
import TokenRepository from './repositories/token-repository.js';
import UserRepository from './repositories/user-repository.js';

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

        this.repositories = {
            blockchain_event: new BlockchainEventRepository(this.models),
            blockchain: new BlockchainRepository(this.models),
            command: new CommandRepository(this.models),
            event: new EventRepository(this.models),
            operation_id: new OperationIdRepository(this.models),
            operation: new OperationRepository(this.models),
            operation_response: new OperationResponseRepository(this.models),
            service_agreement: new ServiceAgreementRepository(this.models),
            shard: new ShardRepository(this.models),
            token: new TokenRepository(this.models),
            user: new UserRepository(this.models),
        };
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
        connection.destroy();
    }

    async dropDatabase() {
        const connection = await mysql.createConnection({
            host: process.env.SEQUELIZE_REPOSITORY_HOST,
            port: process.env.SEQUELIZE_REPOSITORY_PORT,
            user: process.env.SEQUELIZE_REPOSITORY_USER,
            password: process.env.SEQUELIZE_REPOSITORY_PASSWORD,
        });
        await connection.promise().query(`DROP DATABASE IF EXISTS \`${this.config.database}\`;`);
        connection.destroy();
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

    getRepository(repositoryName) {
        return this.repositories[repositoryName];
    }

    async query(query) {
        return this.models.sequelize.query(query);
    }
}

export default SequelizeRepository;
