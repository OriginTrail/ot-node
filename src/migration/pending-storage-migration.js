import path from 'path';
import { readdir } from 'fs/promises';
import BaseMigration from './base-migration.js';
import { PENDING_STORAGE_REPOSITORIES } from '../constants/constants.js';

class PendingStorageMigration extends BaseMigration {
    constructor(migrationName, logger, config, pendingStorageService) {
        super(migrationName, logger, config);
        this.pendingStorageService = pendingStorageService;
    }

    async executeMigration() {
        for (const repository of [
            PENDING_STORAGE_REPOSITORIES.PRIVATE,
            PENDING_STORAGE_REPOSITORIES.PUBLIC,
        ]) {
            const cachePath = path.join(
                this.fileService.getDataFolderPath(),
                'pending_storage_cache',
                repository,
            );

            // eslint-disable-next-line no-await-in-loop
            const assetFolderNames = await this.getFolders(cachePath);
            for (const assetFolderName of assetFolderNames) {
                const [blockchainName, blockchainId, contract, tokenId] =
                    assetFolderName.split(':');
                const assetFolderPath = path.join(cachePath, assetFolderName);
                // eslint-disable-next-line no-await-in-loop
                const assertionIds = await this.fileService.readDirectory(assetFolderPath);
                for (const assertionId of assertionIds) {
                    const filePath = path.join(assetFolderPath, assertionId);
                    // eslint-disable-next-line no-await-in-loop
                    const data = await this.fileService.readFile(filePath);
                    // eslint-disable-next-line no-await-in-loop
                    await this.pendingStorageService.cacheAssertionData(
                        repository,
                        `${blockchainName}:${blockchainId}`,
                        contract,
                        tokenId,
                        assertionId,
                        data,
                    );
                    // eslint-disable-next-line no-await-in-loop
                    await this.fileService.removeFile(filePath);
                }
            }
        }
    }

    async getFolders(directoryPath) {
        try {
            const files = await readdir(directoryPath, { withFileTypes: true });
            return files.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
        } catch (error) {
            return [];
        }
    }
}

export default PendingStorageMigration;
