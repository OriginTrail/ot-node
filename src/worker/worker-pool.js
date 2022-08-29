import workerpool from 'workerpool';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

class WorkerPool {
    constructor() {
        // TODO minWorkers and maxWorkers to be determined automatically by number of logical cores
        // TODO is it necessary to terminate the pool?
        this.pool = workerpool.pool(`${__dirname}/l1-worker.js`, { minWorkers: 2, maxWorkers: 4 });
    }

    offload(fn, args) {
        return new Promise((accept, reject) => {
            this.pool
                .exec(fn, args)
                .then((result) => {
                    accept(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    exec(name, args) {
        return this.pool.exec(name, args);
    }
}

export default WorkerPool;
