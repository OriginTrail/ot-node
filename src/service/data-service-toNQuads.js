import jsonld from 'jsonld';
import {
    MEDIA_TYPES,
} from '../constants/constants.js';
import { fileURLToPath } from 'url';

const ALGORITHM = 'URDNA2015';

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (!isMainThread) { 
    const { content, inputFormat } = workerData;
    const options = {
        algorithm: ALGORITHM,
        format: MEDIA_TYPES.N_QUADS,
    };
    if (inputFormat) {
        options.inputFormat = inputFormat;
    }
    const canonized = await jsonld.canonize(content, options);
    parentPort.postMessage(canonized.split('\n').filter((x) => x !== ''));
}

export default function workerToNQuads(content, inputFormat) {
    const __filename = fileURLToPath(import.meta.url);
    return new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
            workerData: { content, inputFormat },
        });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
};