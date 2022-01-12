require('dotenv').config();

module.exports = {
    username: 'root',
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: 'operationaldb',
    dialect: 'mysql',
    host: 'localhost',
    port: 3306,
    migrationStorageTableName: 'sequelize_meta',
    logging: false,
    operatorsAliases: '0',
    define: {
        underscored: true,
        timestamps: true,
    },
};
