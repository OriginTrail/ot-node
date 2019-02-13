const { fork } = require('child_process');
const Models = require('../../models/index');

const DEFAULT_DIFFICULTY = 1;

class MinerService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.dcService = ctx.dcService;
        this.emitter = ctx.emitter;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Call miner process
     * @param task
     * @param wallets
     * @param difficulty
     * @param offerId
     */
    async sendToMiner(task, difficulty, wallets, offerId) {
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

            await Models.miner_tasks.create({
                offer_id: offerId,
                difficulty,
                task,
                status: 'STARTED',
            });

            this.logger.important(`Miner started for offer ${offerId}.`);
        } catch (e) {
            this.logger.error(`Failed to find solution for ${wallets.length} wallets and task ${task}. Offer ${offerId}`);
        }
    }
}

module.exports = MinerService;
