const { fork } = require('child_process');
const Models = require('../../models/index');

const DEFAULT_DIFFICULTY = 1;

class MinerService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.dcService = ctx.dcService;
        this.emitter = ctx.emitter;
    }

    /**
     * Call miner process
     * @param task
     * @param wallets
     * @param offerId
     */
    async sendToMiner(task, wallets, offerId) {
        try {
            const forked = fork('modules/worker/miner-worker.js');
            forked.send({
                offerId,
                wallets,
                difficulty: DEFAULT_DIFFICULTY, // TODO take from configuration
                task,
                type: 'TASK',
            });

            forked.on('message', (msg) => {
                const parsed = JSON.parse(msg);
                if (parsed.success) {
                    this.emitter.emit('int-miner-solution', null, parsed);
                } else {
                    this.emitter.emit('int-miner-solution', new Error(`Cannot find a solution for offer ${offerId}`), null);
                }
            });
            await Models.miner_records.create({
                offer_id: offerId,
                difficulty: DEFAULT_DIFFICULTY,
                task,
                status: 'STARTED',
            });
        } catch (e) {
            this.logger.error(`Failed to find solution for ${wallets.length} wallets and task ${task}. Offer ID ${offerId}`);
        }
    }
}

module.exports = MinerService;
