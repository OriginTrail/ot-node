const BN = require('bn.js');
const miner = require('../miner');
const utilities = require('../Utilities');

process.once('message', (msg) => {
    const { type, offerId } = msg;

    if (type === 'PING') {
        process.send(JSON.stringify({
            offerId,
            type,
            result: 'PONG',
        }));
        return;
    }
    const task = new BN(utilities.denormalizeHex(msg.task), 16);
    const wallets = msg.wallets.map(w => new BN(utilities.denormalizeHex(w), 16));
    try {
        const solution = miner.solve(wallets, task, msg.difficulty);
        if (solution === false) {
            // failed to find a solution
            process.send(JSON.stringify({
                offerId,
                message: 'Failed to find a solution',
                success: false,
                type,
            }));
            process.exit(0);
        }
        // found a solution
        process.send(JSON.stringify({
            offerId: msg.offerId,
            result: solution,
            message: 'Found a solution',
            success: true,
            type,
        }));
        process.exit(1);
    } catch (e) {
        process.send(JSON.stringify({
            offerId: msg.offerId,
            message: e.message,
            success: false,
            type,
        }));
        process.exit(1);
    }
});

process.once('SIGTERM', () => process.exit(0));
