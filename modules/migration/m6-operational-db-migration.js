// eslint-disable-next-line import/no-extraneous-dependencies
const { Pool } = require('pg');

/**
 * Changes the arango password to a randomly generated one
 */
class M6OperationalDBMigration {
    constructor({ config, log }) {
        this.config = config;
        this.log = log;
    }

    /**
     * Run migration
     */
    async run() {
        try {
            const pool = new Pool({
                user: 'root',
                host: this.config.operational_db.host,
                database: this.config.operational_db.database,
                password: 'origintrail',
                port: this.config.operational_db.port,
            });
            const client = await pool.connect();
            try {
                await client.query(`CREATE USER ${this.config.operational_db.username} WITH Replication PASSWORD '${this.config.operational_db.password}'`);
                await client.query(`ALTER DATABASE ${this.config.operational_db.database} OWNER TO ${this.config.operational_db.username}`);
                await client.query(`ALTER USER root WITH PASSWORD '${this.config.operational_db.root_user_password}'`);
            } catch (e) {
                this.log.error('Operation db migration failed! Error: ', e.message);
                return -1;
            } finally {
                client.release();
            }
            return 0;
        } catch (error) {
            this.log.error('Operation db migration failed! Error: ', error);
            return -1;
        }
    }
}

module.exports = M6OperationalDBMigration;
