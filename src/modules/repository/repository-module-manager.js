const BaseModuleManager = require('../base-module-manager');

class RepositoryModuleManager extends BaseModuleManager {
    getName() {
        return 'repository';
    }

    transaction(execFn) {
        if (this.initialized) {
            return this.getImplementation().module.transaction(execFn);
        }
    }

    // COMMANDS
    async updateCommand(update, opts) {
        if (this.initialized) {
            return this.getImplementation().module.updateCommand(update, opts);
        }
    }

    async destroyCommand(name) {
        if (this.initialized) {
            return this.getImplementation().module.destroyCommand(name);
        }
    }

    async createCommand(command, opts) {
        if (this.initialized) {
            return this.getImplementation().module.createCommand(command, opts);
        }
    }

    async getCommandsWithStatus(statusArray, excludeNameArray = []) {
        if (this.initialized) {
            return this.getImplementation().module.getCommandsWithStatus(
                statusArray,
                excludeNameArray,
            );
        }
    }

    async getCommandWithId(id) {
        if (this.initialized) {
            return this.getImplementation().module.getCommandWithId(id);
        }
    }

    // HANDLER ID TABLE
    async createHandlerIdRecord(handlerData) {
        if (this.initialized) {
            return this.getImplementation().module.createHandlerIdRecord(handlerData);
        }
    }

    async updateHandlerIdRecord(data, handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.updateHandlerIdRecord(data, handlerId);
        }
    }

    async getHandlerIdRecord(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getHandlerIdRecord(handlerId);
        }
    }

    // PUBLISH REQUEST TABLE
    async createPublishResponseRecord(status, handlerId, message = null) {
        if (this.initialized) {
            return this.getImplementation().module.createPublishResponseRecord(
                status,
                handlerId,
                message,
            );
        }
    }

    async updatePublishResponseRecord(data, condition) {
        if (this.initialized) {
            return this.getImplementation().module.updatePublishResponseRecord(data, condition);
        }
    }

    async getNumberOfPublishResponses(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getNumberOfPublishResponses(handlerId);
        }
    }

    async getPublishResponsesStatuses(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getPublishResponsesStatuses(handlerId);
        }
    }
}

module.exports = RepositoryModuleManager;
