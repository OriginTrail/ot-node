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
    async createOperationRecord(operation, handlerId, status) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationRecord(
                operation,
                handlerId,
                status,
            );
        }
    }

    async getOperationStatus(operation, handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationStatus(operation, handlerId);
        }
    }

    async updateOperationStatus(operation, handlerId, status) {
        if (this.initialized) {
            return this.getImplementation().module.updateOperationStatus(
                operation,
                handlerId,
                status,
            );
        }
    }

    async createOperationResponseRecord(status, operation, handlerId, keyword, errorMessage) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationResponseRecord(
                status,
                operation,
                handlerId,
                keyword,
                errorMessage,
            );
        }
    }

    async getNumberOfOperationResponses(operation, handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getNumberOfOperationResponses(
                operation,
                handlerId,
            );
        }
    }

    async getOperationResponsesStatuses(operation, handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationResponsesStatuses(
                operation,
                handlerId,
            );
        }
    }

    async countOperationResponseStatuses(operation, handlerId) {
        if (this.initialized) {
            return this.getImplementation().module.countOperationResponseStatuses(
                operation,
                handlerId,
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
