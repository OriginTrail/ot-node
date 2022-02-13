const workerpool = require("workerpool");
const jsonld = require("jsonld");


class WorkerPool {
    constructor() {
        //TODO minWorkers and maxWorkers to be determined automatically by number of logical cores
        //TODO is it necessary to terminate the pool?
        this.pool = workerpool.pool(__dirname + '/l1-worker.js',{minWorkers: 2, maxWorkers: 4});
    }

    offload(fn, args) {
        return new Promise((accept, reject) => {
            this.pool.exec(fn, args)
                .then(function (result) {
                    accept(result);
                })
                .catch(function (err) {
                    reject(err);
                });
        })
    }

    exec(name, args) {
        return this.pool.exec(name, args)
    }
}

module.exports = WorkerPool;