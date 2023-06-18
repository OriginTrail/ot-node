import path from 'path';
import { mkdir } from 'fs/promises';
import { PENDING_STORAGE_REPOSITORIES } from '../constants/constants.js';
import BaseMigration from './base-migration.js';

class PendingStorageMigration extends BaseMigration {
    async executeMigration() {
        const promises = Object.values(PENDING_STORAGE_REPOSITORIES).map(async (repository) => {
            let fileNames;
            const repositoryPath = this.fileService.getPendingStorageCachePath(repository);
            try {
                fileNames = await this.fileService.readDirectory(repositoryPath);
            } catch (error) {
                return false;
            }

            await Promise.all(
                fileNames.map(async (fileName) => {
                    const newDirectoryPath = path.join(repositoryPath, fileName);
                    const cachedData = await this.fileService._readFile(newDirectoryPath, true);
                    await this.fileService.removeFile(newDirectoryPath);
                    if (cachedData?.public?.assertionId) {
                        const newDocumentName = this.fileService.getPendingStorageFileName(
                            cachedData.public.assertionId,
                        );
                        await mkdir(newDirectoryPath, { recursive: true });
                        await this.fileService.writeContentsToFile(
                            newDirectoryPath,
                            newDocumentName,
                            cachedData,
                        );
                    }
                }),
            );
        });

        await Promise.all(promises);
    }
}

export default PendingStorageMigration;
