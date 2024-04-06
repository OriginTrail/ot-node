import { open } from 'lmdb';
import PendingStorageDatabase from './repositories/pending-storage.js';

class LMDBService {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;

        this.rootDatabase = open({
            path: this.config.appDataPath,
            encoding: 'msgpack',
            cache: true,
        });
        this.databases = {
            pending_storage: new PendingStorageDatabase(this.rootDatabase),
        };
    }

    getDatabase(databaseName) {
        return this.databases[databaseName];
    }
}

export default LMDBService;
