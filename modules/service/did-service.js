class DIDService {
    /**
     * Default constructor
     * @param ctx
     */
    constructor(ctx) {
        this.supportedNetworks = [
            'did:ethr:', 'did:sfl:',
        ];
    }


    /**
     * Returns the network ID the DID is from
     * @param identifier {String} - The DID value
     * @returns {String|undefined} - Returns the network ID of underfined if the DID is
     * not supported
     */
    extractNetworkIDFromDID(identifier) {
        for (const netId of this.supportedNetworks) {
            if (identifier.startsWith(netId)) return netId;
        }
        return undefined;
    }

    /**
     * Returns the DID created by combining the network ID with the base value
     * @param value {String} - The identifier value to be converted to a did
     * @param networkID {String} - The decentralized network identifier
     * @returns {String} - The DID value
     */
    encodeDID(value, networkID) {
        return `${networkID}${value}`;
    }
}

module.exports = DIDService;
