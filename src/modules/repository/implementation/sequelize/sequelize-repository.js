const mysql = require('mysql2');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const Sequelize = require('sequelize');

class SequelizeRepository {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.setEnvParameters();
        await this.createDatabaseIfNotExists();
        await this.runMigrations();

        this.models = await this.loadModels();
    }

    setEnvParameters() {
        process.env.SEQUELIZE_REPOSITORY_USER = this.config.user;
        const useEnvPassword =
            process.env.REPOSITORY_PASSWORD && process.env.REPOSITORY_PASSWORD !== '';
        process.env.SEQUELIZE_REPOSITORY_PASSWORD = useEnvPassword
            ? process.env.REPOSITORY_PASSWORD
            : this.config.password;
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
        return new Promise((resolve, reject) => {
            const configurationPath = path.join(__dirname, 'config', 'sequelizeConfig.js');
            const migrationFolderPath = path.join(__dirname, 'migrations');
            const migrate = exec(
                `npx sequelize --config=${configurationPath} --migrations-path=${migrationFolderPath} db:migrate`,
                { env: process.env },
                (err) => (err ? reject(err) : resolve()),
            );
            if (this.config.logging) {
                // Forward stdout+stderr to this process
                migrate.stdout.pipe(process.stdout);
                migrate.stderr.pipe(process.stderr);
            }
        });
    }

    async loadModels() {
        const modelsDirectory = path.join(__dirname, 'models');
        // disable automatic timestamps
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
        const models = {};
        fs.readdirSync(modelsDirectory)
            .filter((file) => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
            .forEach((file) => {
                // eslint-disable-next-line global-require,import/no-dynamic-require
                const model = require(path.join(modelsDirectory, file))(
                    sequelize,
                    Sequelize.DataTypes,
                );
                models[model.name] = model;
            });

        Object.keys(models).forEach((modelName) => {
            if (models[modelName].associate) {
                models[modelName].associate(models);
            }
        });
        models.sequelize = sequelize;
        models.Sequelize = Sequelize;

        return models;
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

    // HANDLER_ID
    async createHandlerIdRecord(handlerData) {
        const handlerRecord = await this.models.handler_ids.create(handlerData);
        return handlerRecord;
    }

    async getHandlerIdRecord(handlerId) {
        const handlerRecord = await this.models.handler_ids.findOne({
            where: {
                handler_id: handlerId,
            },
        });
        return handlerRecord;
    }

    async updateHandlerIdRecord(data, handlerId) {
        await this.models.handler_ids.update(data, {
            where: {
                handler_id: handlerId,
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

    // RESOLVE
    async createResolveRecord(handlerId, status) {
        return this.models.resolve.create({
            handler_id: handlerId,
            status,
        });
    }

    async getResolveStatus(handlerId) {
        return this.models.resolve.findOne({
            attributes: ['status'],
            where: {
                handler_id: handlerId,
            },
        });
    }

    async updateResolveStatus(handlerId, status) {
        await this.models.resolve.update(
            { status },
            {
                where: {
                    handler_id: handlerId,
                },
            },
        );
    }

    // PUBLISH
    async createPublishRecord(handlerId, status) {
        return this.models.publish.create({
            handler_id: handlerId,
            status,
        });
    }

    async getPublishStatus(handlerId) {
        return this.models.publish.findOne({
            attributes: ['status'],
            where: {
                handler_id: handlerId,
            },
        });
    }

    async updatePublishStatus(handlerId, status) {
        await this.models.publish.update(
            { status },
            {
                where: {
                    handler_id: handlerId,
                },
            },
        );
    }

    // PUBLISH RESPONSE
    async createPublishResponseRecord(status, handlerId, message) {
        await this.models.publish_response.create({
            status,
            message,
            handler_id: handlerId,
        });
    }

    async getNumberOfPublishResponses(handlerId) {
        return this.models.publish_response.count({
            where: {
                handler_id: handlerId,
            },
        });
    }

    async getPublishResponsesStatuses(handlerId) {
        return this.models.publish_response.findAll({
            attributes: ['status'],
            where: {
                handler_id: handlerId,
            },
        });
    }

    async countPublishResponseStatuses(handlerId) {
        return this.models.publish_response.findAll({
            attributes: [
                'status',
                [Sequelize.fn('COUNT', Sequelize.col('status')), 'count_status'],
            ],
            group: 'status',
            where: {
                handler_id: handlerId,
            },
        });
    }

    // RESOLVE RESPONSE
    async createResolveResponseRecord(status, handlerId, errorMessage) {
        await this.models.resolve_response.create({
            status,
            errorMessage,
            handler_id: handlerId,
        });
    }

    async getResolveResponsesStatuses(handlerId) {
        return this.models.resolve_response.findAll({
            attributes: ['status'],
            where: {
                handler_id: handlerId,
            },
        });
    }

    // EVENT
    async createEventRecord(handlerId, name, timestamp, value1, value2, value3) {
        return this.models.event.create({
            handler_id: handlerId,
            name,
            timestamp,
            value1,
            value2,
            value3,
        });
    }

    async getAllEvents() {
        return this.models.event.findAll();
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
        return this.models.User.findOne({
            where: {
                name: username,
            },
        });
    }

    async saveToken(tokenId, userId, tokenName, expiresAt) {
        return this.models.Token.create({
            id: tokenId,
            userId,
            expiresAt,
            name: tokenName,
        });
    }

    async isTokenRevoked(tokenId) {
        const token = await this.models.Token.findByPk(tokenId);

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
}

module.exports = SequelizeRepository;
