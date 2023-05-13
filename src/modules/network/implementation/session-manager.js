class SessionManager {
    constructor(logger) {
        this.logger = logger;
        this.sessions = {};
    }

    getSessionStream(operationId, keywordUuid, remotePeerId) {
        const session = this.sessions[remotePeerId]?.[operationId]?.[keywordUuid];
        if (session) {
            this.logger.trace(
                `Session found for remotePeerId: ${remotePeerId}, operation id: ${operationId}`,
            );
            return session.stream;
        }
        return null;
    }

    updateSessionStream(operationId, keywordUuid, remotePeerId, stream) {
        this.logger.trace(
            `Storing new session stream for remotePeerId: ${remotePeerId} with operation id: ${operationId}`,
        );

        this.sessions[remotePeerId] = this.sessions[remotePeerId] || {};
        this.sessions[remotePeerId][operationId] = this.sessions[remotePeerId][operationId] || {};
        this.sessions[remotePeerId][operationId][keywordUuid] = { stream };
    }

    sessionExists(remotePeerId, operationId, keywordUuid) {
        return this.sessions[remotePeerId]?.[operationId]?.[keywordUuid]?.stream;
    }
}

export default SessionManager;
