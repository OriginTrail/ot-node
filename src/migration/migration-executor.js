import path from 'path';

class MigrationExecutor {
    static exitNode(code = 0) {
        process.exit(code);
    }

    static async migrationAlreadyExecuted(migrationName, fileService) {
        const migrationFilePath = path.join(fileService.getMigrationFolderPath(), migrationName);
        if (await fileService.pathExists(migrationFilePath)) {
            return true;
        }
        return false;
    }
}

export default MigrationExecutor;
