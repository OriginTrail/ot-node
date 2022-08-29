export default {
    username: process.env.SEQUELIZE_REPOSITORY_USER,
    password: process.env.SEQUELIZE_REPOSITORY_PASSWORD,
    database: process.env.SEQUELIZE_REPOSITORY_DATABASE,
    dialect: process.env.SEQUELIZE_REPOSITORY_DIALECT,
    host: process.env.SEQUELIZE_REPOSITORY_HOST,
    port: process.env.SEQUELIZE_REPOSITORY_PORT,
    migrationStorageTableName: 'sequelize_meta',
    logging: false,
    operatorsAliases: '0',
    define: {
        underscored: true,
        timestamps: true,
    },
};
