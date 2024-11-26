import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

import jsonld from 'jsonld';
import { fileURLToPath } from 'url';

if (!isMainThread) {
    const { content, options } = workerData;
    const canonized = await jsonld.canonize(content, options);
    parentPort.postMessage(canonized.split('\n').filter((x) => x !== ''));
}

export default function toNQuadsWorker(content, options) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(fileURLToPath(import.meta.url), {
            workerData: { content, options },
        });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
};