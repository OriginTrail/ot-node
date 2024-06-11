import path from 'path';
import BaseMigration from './base-migration.js';

class OperationIdStorageMigration extends BaseMigration {
    constructor(migrationName, logger, config, operationIdService) {
        super(migrationName, logger, config);
        this.operationIdService = operationIdService;
    }

    async executeMigration() {
        const cacheFolderPath = path.join(
            this.fileService.getDataFolderPath(),
            'operation_id_cache',
        );
        const cacheFolderExists = await this.fileService.pathExists(cacheFolderPath);
        if (!cacheFolderExists) {
            return;
        }
        const fileList = await this.fileService.readDirectory(cacheFolderPath);

        for (const operationId of fileList) {
            const filePath = path.join(cacheFolderPath, operationId);
            // eslint-disable-next-line no-await-in-loop
            const data = await this.fileService.readFile(filePath);
            // eslint-disable-next-line no-await-in-loop
            await this.operationIdService.cacheOperationIdData(operationId, data);
            // eslint-disable-next-line no-await-in-loop
            await this.fileService.removeFile(filePath);
        }

        await this.fileService.removeFolder(cacheFolderPath);
    }
}

export default OperationIdStorageMigration;
