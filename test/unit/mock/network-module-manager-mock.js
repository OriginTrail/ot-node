class NetworkModuleManagerMock {
    getPeerId() {
        return {
            toB58String: () => 'myPeerId',
        };
    }
}

export default NetworkModuleManagerMock;
