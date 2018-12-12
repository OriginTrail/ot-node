const { fork } = require('child_process');
const Models = require('../../models/index');

const DEFAULT_DIFFICULTY = 1;

class MinerService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.dcService = ctx.dcService;
        this.emitter = ctx.emitter;
        this.blockchain = ctx.blockchain;
        this.forks = {};
    }

    /**
     * Call miner process
     * @param task
     * @param difficulty
     * @param wallets
     * @param internalOfferId
     */
    async sendToMiner(task, difficulty, wallets, internalOfferId) {
        try {
            const forked = fork('modules/worker/miner-worker.js');
            this.forks[internalOfferId] = forked;

            forked.send({
                internalOfferId,
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
                    this.emitter.emit('int-miner-solution', new Error(`Cannot find a solution for offer with internal ID ${internalOfferId}`), null);
                }
            });

            await Models.miner_records.create({
                offer_id: internalOfferId,
                difficulty,
                task,
                status: 'STARTED',
            });

            this.logger.important(`Miner started for offer with internal ID ${internalOfferId}.`);
        } catch (e) {
            this.logger.error(`Failed to find solution for ${wallets.length} wallets and task ${task}. Offer internal ID ${internalOfferId}`);
        }
    }
}

module.exports = MinerService;
