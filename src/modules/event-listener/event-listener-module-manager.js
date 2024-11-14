import BaseModuleManager from '../base-module-manager.js';

class EventListenerModuleManager extends BaseModuleManager {
    constructor(ctx) {
        super(ctx);
        this.ctx = ctx;
    }

    async initializeEventListener(eventListenerImplementation) {
        if (this.getImplementation(eventListenerImplementation)) {
            return this.getImplementation(
                eventListenerImplementation,
            ).module.initializeEventListener(this.ctx);
        }
    }

    async startListeningOnEvents(eventListenerImplementation) {
        if (this.getImplementation(eventListenerImplementation)) {
            return this.getImplementation(
                eventListenerImplementation,
            ).module.startListeningOnEvents();
        }
    }

    getName() {
        return 'eventListener';
    }
}

export default EventListenerModuleManager;
