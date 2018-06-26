/**
 * Kademlia utility methods
 */
class KademliaUtils {
    /**
     * Skips/Transformes Kademlia log
     * @return {*}
     */
    static transformLog(level, msg) {
        if (msg.startsWith('updating peer profile')) {
            return null; // skip logging
        }
        if (msg.includes('KADemlia error') && msg.includes('Message previously routed')) {
            return null; // skip logging
        }
        if (msg.startsWith('connect econnrefused')) {
            level = 'trace';
            const address = msg.substr(21);
            msg = `Failed to connect to ${address}`;
        }
        return {
            level,
            msg,
        };
    }
}

module.exports = KademliaUtils;
