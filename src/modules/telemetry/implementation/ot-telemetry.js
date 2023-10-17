import axios from 'axios';

class OTTelemetry {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    listenOnEvents(eventEmitter, onEventReceived) {
        return eventEmitter.on('operation_status_changed', onEventReceived);
    }

    async sendTelemetryData(nodeData, events) {
        const signalingMessage = { nodeData, events };
        const config = {
            method: 'post',
            url: this.config.signalingServerUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            data: JSON.stringify(signalingMessage),
        };
        const response = await axios(config);
        const isSuccess = response.status === 200;
        return isSuccess;
    }
}

export default OTTelemetry;
