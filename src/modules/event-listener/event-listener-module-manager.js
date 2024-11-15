import BaseModuleManager from '../base-module-manager.js';

class EventListenerModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.ctx = ctx;
    }

    async initializeAndStartEventListener(eventListenerImplementation) {
        if (this.getImplementation(eventListenerImplementation)) {
            return this.getImplementation(
                eventListenerImplementation,
            ).module.initializeAndStartEventListener(this.ctx);
        }
    }

    getName() {
        return 'eventListener';
    }
}

export default EventListenerModuleManager;
