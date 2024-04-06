import { open } from 'lmdb';
import PendingStorageDatabase from './databases/pending-storage.js';
import OperationIdStorageDatabase from './databases/operation-id-storage.js';

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
            operation_id_storage: new OperationIdStorageDatabase(this.rootDatabase)
        };
    }

    getDatabase(databaseName) {
        return this.databases[databaseName];
    }
}

export default LMDBService;
