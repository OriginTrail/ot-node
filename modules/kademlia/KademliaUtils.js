/**
 * Kademlia utility methods
 */
class KademliaUtils {
    /**
     * Skips/Transformes Kademlia log
     * @return {*}
     */
    static transformLog(level, msg) {
        if (msg.startsWith('connection timed out')) {
            return null; // skip logging
        }
        if (msg.startsWith('negotiation error')) {
            return null; // skip logging
        }
        if (msg.includes('received late or invalid response')) {
            return null; // skip logging
        }
        if (msg.includes('error with remote connection')) {
            return null;
        }
        if (msg.includes('remote connection encountered error')) {
            return null;
        }
        if (msg.startsWith('updating peer profile')) {
            return null; // skip logging
        }
        if (msg.includes('client cannot service request at this time')) {
            return null; // skip logging
        }
        if (msg.includes('KADemlia error') && msg.includes('Message previously routed')) {
            return null; // skip logging
        }
        if (msg.includes('gateway timeout')) {
            return null; // skip logging
        }
        if (msg.startsWith('connect econnrefused')) {
            level = 'trace';
            const address = msg.substr(21);
            msg = `Peer ${address} timed out`;
        }
        if (msg.includes('HSDir')) {
            return null;
        }
        if (msg.includes('servicesscrubbed.onion')) {
            return null;
        }
        if (msg.includes('unable to route to tunnel')) {
            return null;
        }
        if (msg.includes('socket hang up')) {
            return null;
        }
        if (msg.includes('getaddrinfo')) {
            return null;
        }
        return {
            level,
            msg,
        };
    }
}

module.exports = KademliaUtils;
