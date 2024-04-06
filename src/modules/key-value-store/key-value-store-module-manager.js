import BaseModuleManager from '../base-module-manager.js';

class KeyValueStoreModuleManager extends BaseModuleManager {
    getName() {
        return 'keyValueStore';
    }

    getPendingStorageDatabase(databaseName) {
        if (!this.initialized) {
            throw new Error(`KeyValueStoreModuleManager not initialized`);
        }
        return this.getImplementation().module.getDatabase(databaseName);
    }

    async cacheAssertionData(repository, ual, assertionId, assertionData) {
        return this.getPendingStorageDatabase('pending_storage').cacheAssertionData(
            repository,
            ual,
            assertionId,
            assertionData,
        );
    }

    async getCachedAssertionData(repository, ual, assertionId) {
        return this.getPendingStorageDatabase('pending_storage').getCachedAssertionData(
            repository,
            ual,
            assertionId,
        );
    }

    async removeCachedAssertionData(repository, ual, assertionId) {
        return this.getPendingStorageDatabase('pending_storage').removeCachedAssertionData(
            repository,
            ual,
            assertionId,
        );
    }

    async getLatestCachedAssertionData(repository, ual) {
        return this.getPendingStorageDatabase('pending_storage').getLatestCachedAssertionData(
            repository,
            ual,
        );
    }
}

export default KeyValueStoreModuleManager;
