import axios from 'axios';

class TelemetryService {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    listenOnEvents(eventEmitter, onEventRecived) {
        return eventEmitter.on('operation_status_changed', onEventRecived);
    }

    async sendTelemetryData(nodeData, events) {
        const signalingMessage = { nodeData, events };
        const config = {
            method: 'post',
            // TODO: Use config to get url
            url: this.config.signalingServerUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            data: JSON.stringify(signalingMessage),
        };
        const response = await axios(config);
        return response;
    }
}

export default TelemetryService;
