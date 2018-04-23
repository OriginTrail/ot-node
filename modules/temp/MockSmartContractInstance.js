let instance = null;

class MockSmartContractInstance {
    constructor() {
        if (!instance) {
            instance = this;
        }
        return instance;
    }
}

module.exports = new MockSmartContractInstance();
