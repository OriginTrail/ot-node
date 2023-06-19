class ArchiveService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
    }

    async archiveData(archiveFolderName, archiveFileName, data) {
        const archiveFolderPath = this.fileService.getArchiveFolderPath(archiveFolderName);
        this.logger.debug(
            `Archiving data on path: ${archiveFolderPath} with archive name: ${archiveFileName}`,
        );
        await this.fileService.writeContentsToFile(
            archiveFolderPath,
            archiveFileName,
            JSON.stringify(data),
        );
    }
}
export default ArchiveService;
