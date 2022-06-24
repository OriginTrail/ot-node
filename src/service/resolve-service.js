const { RESOLVE_REQUEST_STATUS } = require('../constants/constants');

class ResolveService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.commandExecutor = ctx.commandExecutor;
    }

    async processResolveResponse(command, errorMessage = null) {
        if (errorMessage) {
            await this.repositoryModuleManager.createResolveResponseRecord(
                RESOLVE_REQUEST_STATUS.FAILED,
                command.data.resolveId,
                errorMessage,
            );
        } else {
            await this.repositoryModuleManager.createResolveResponseRecord(
                RESOLVE_REQUEST_STATUS.COMPLETED,
                command.data.resolveId,
            );
        }
        const numberOfResponses = await this.repositoryModuleManager.getNumberOfResolveResponses(
            command.data.resolveId,
        );
        if (numberOfResponses > 0) {
            await this.commandExecutor.add({
                name: 'resolveFinaliseCommand',
                sequence: [],
                data: {},
                transactional: false,
            });
        }
    }
}

module.exports = ResolveService;
