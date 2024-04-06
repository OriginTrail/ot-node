class PendingStorageDatabase {
    constructor(rootRepository) {
        this.repositories = {
            public: rootRepository.openDB(`public-${this.getName()}`, { dupSort: true }),
            private: rootRepository.openDB(`private-${this.getName()}`, { dupSort: true }),
        };
    }

    getName() {
        return 'pendingStorage';
    }

    async cacheAssertionData(repository, ual, assertionId, assertionData) {
        return this.repositories[repository].put(ual, {
            timestamp: Date.now(),
            assertionId,
            data: assertionData,
        });
    }

    async getCachedAssertionData(repository, ual, assertionId) {
        const values = await this.repositories[repository].getValues(ual);

        for (const value of values) {
            if (value?.assertionId === assertionId) {
                return value.data;
            }
        }

        return null;
    }

    async removeCachedAssertionData(repository, ual, assertionId) {
        const values = await this.repositories[repository].getValues(ual);

        for (const value of values) {
            if (value?.assertionId === assertionId) {
                // eslint-disable-next-line no-await-in-loop
                await this.repositories[repository].remove(ual, value);
            }
        }
    }

    async getLatestCachedAssertionData(repository, ual) {
        let values = await this.repositories[repository].getValues(ual);

        values = values?.asArray;
        if (!values?.length) return;

        values.sort((a, b) => b.timestamp - a.timestamp);

        return values[0].data;
    }
}

export default PendingStorageDatabase;
