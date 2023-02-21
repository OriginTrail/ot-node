import Web3Service from '../web3-service.js';

class GanacheService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'GANACHE_TOKENS';
        this.tracTicker = 'gTRAC';
    }

    async increaseGanacheTime(seconds) {
        await this.provider.send(
            {
                method: 'evm_increaseTime',
                params: [seconds],
            },
            () => {},
        );

        await this.provider.send(
            {
                method: 'evm_mine',
                params: [],
            },
            () => {},
        );
    }
}

export default GanacheService;
