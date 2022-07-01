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

    // publish table
    async createPublishRecord(handlerId, status) {
        if (this.initialized) {
            return this.getImplementation().module.createPublishRecord(handlerId, status);
        }
    }

    async getPublishStatus(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getPublishStatus(handlerId);
        }
    }

    async updatePublishStatus(handlerId, status) {
        if (this.initialized) {
            return this.getImplementation().module.updatePublishStatus(handlerId, status);
        }
    }

    // publish response TABLE
    async createPublishResponseRecord(status, handlerId, errorMessage) {
        if (this.initialized) {
            return this.getImplementation().module.createPublishResponseRecord(
                status,
                handlerId,
                errorMessage,
            );
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

    async countPublishResponseStatuses(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.countPublishResponseStatuses(handlerId);
        }
    }

    // resolve
    async createResolveRecord(handlerId, status) {
        if (this.initialized) {
            return this.getImplementation().module.createResolveRecord(handlerId, status);
        }
    }

    async getResolveStatus(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getResolveStatus(handlerId);
        }
    }

    async updateResolveStatus(handlerId, status) {
        if (this.initialized) {
            return this.getImplementation().module.updateResolveStatus(handlerId, status);
        }
    }

    // resolve response
    async getResolveResponsesStatuses(handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getResolveResponsesStatuses(handlerId);
        }
    }

    async createResolveResponseRecord(status, handlerId, errorMessage) {
        if (this.initialized) {
            return this.getImplementation().module.createResolveResponseRecord(
                status,
                handlerId,
                errorMessage,
            );
        }
    }

    // EVENT
    async createEventRecord(
        handlerId,
        name,
        timestamp,
        value1 = null,
        value2 = null,
        value3 = null,
    ) {
        if (this.initialized) {
            return this.getImplementation().module.createEventRecord(
                handlerId,
                name,
                timestamp,
                value1,
                value2,
                value3,
            );
        }
    }

    async getAllEvents() {
        if (this.initialized) {
            return this.getImplementation().module.getAllEvents();
        }
    }

    async destroyEvents(ids) {
        if (this.initialized) {
            return this.getImplementation().module.destroyEvents(ids);
        }
    }
}

module.exports = RepositoryModuleManager;
