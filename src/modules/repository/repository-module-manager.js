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

    // OPERATION ID TABLE
    async createOperationIdRecord(handlerData) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationIdRecord(handlerData);
        }
    }

    async updateOperationIdRecord(data, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.updateOperationIdRecord(data, operationId);
        }
    }

    async getOperationIdRecord(operationId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationIdRecord(operationId);
        }
    }

    // publish table
    async createOperationRecord(operation, operationId, status) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationRecord(
                operation,
                operationId,
                status,
            );
        }
    }

    async getOperationStatus(operation, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationStatus(operation, operationId);
        }
    }

    async updateOperationStatus(operation, operationId, status) {
        if (this.initialized) {
            return this.getImplementation().module.updateOperationStatus(
                operation,
                operationId,
                status,
            );
        }
    }

    async createOperationResponseRecord(status, operation, operationId, keyword, errorMessage) {
        if (this.initialized) {
            return this.getImplementation().module.createOperationResponseRecord(
                status,
                operation,
                operationId,
                keyword,
                errorMessage,
            );
        }
    }

    async getNumberOfOperationResponses(operation, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.getNumberOfOperationResponses(
                operation,
                operationId,
            );
        }
    }

    async getOperationResponsesStatuses(operation, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.getOperationResponsesStatuses(
                operation,
                operationId,
            );
        }
    }

    async countOperationResponseStatuses(operation, operationId) {
        if (this.initialized) {
            return this.getImplementation().module.countOperationResponseStatuses(
                operation,
                operationId,
            );
        }
    }

    // EVENT
    async createEventRecord(
        operationId,
        name,
        timestamp,
        value1 = null,
        value2 = null,
        value3 = null,
    ) {
        if (this.initialized) {
            return this.getImplementation().module.createEventRecord(
                operationId,
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
