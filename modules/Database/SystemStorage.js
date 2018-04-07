// const sqlite3 = require('sqlite3').verbose();
const Sequelize = require('sequelize');

let instance = null;

class SystemStorage {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }

    /**
     * Creates connection with SQLite system database located in ./system.db file
     * @returns {Promise<any>}
     */
    connect() {
        return new Promise((resolve, reject) => {
            const sequelize = new Sequelize({
                host: 'localhost',
                dialect: 'sqlite',
                operatorsAliases: false,
                logging: false,

                define: {
                    timestamps: false, // true by default
                },

                pool: {
                    max: 5,
                    min: 0,
                    acquire: 30000,
                    idle: 10000,
                },

                // SQLite only
                storage: './modules/Database/system.db',
            });
            sequelize
                .authenticate()
                .then(() => {
                    console.log('Connection has been established successfully.');
                    resolve(sequelize);
                })
                .catch((err) => {
                    console.error('Unable to connect to the database:', err);
                    reject(err);
                });
        });
    }


}

module.exports = SystemStorage;

