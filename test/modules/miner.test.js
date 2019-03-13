const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const BN = require('bn.js');
const abi = require('ethereumjs-abi');
const miner = require('../../modules/miner');
const Utilities = require('../../modules/Utilities');

console.log(miner);

describe('PoW MinerTest, generating random wallets and trying to find task solution.' +
    'Solving is done by brute force attempts to generate SHA3 hash of three different wallet addresses that contains' +
    'task substring', () => {
    function digitToHex(digit) {
        if (digit < 10) {
            return digit.toString();
        }


        return String.fromCharCode((65 + digit) - 10);
    }

    function randomHexDigit() {
        return digitToHex(Utilities.getRandomInt(16));
    }

    function randomWallet() {
        let wallet = '';
        for (let i = 0; i < 40; i += 1) {
            const digit = randomHexDigit();
            wallet += digit;
        }
        return new BN(wallet, 16);
    }

    function generateTask(T) {
        let task = '';

        for (let i = 0; i < T; i += 1) {
            task += randomHexDigit();
        }

        return new BN(task, 16);
    }

    function randomNWallets(n) {
        const wallets = [];
        for (let i = 0; i < n; i += 1) {
            wallets.push(randomWallet());
        }

        return wallets;
    }

    it('Should not find solution for single node wallet address', () => {
        const wallets = randomNWallets(1);
        const task = generateTask(1);
        const difficulty = 1;

        assert.isFalse(miner.solve(wallets, task, difficulty), 'Should not find solution');
    });

    it('Should not find solution for two node wallet address', () => {
        const wallets = randomNWallets(2);
        const task = generateTask(1);
        const difficulty = 1;

        assert.isFalse(miner.solve(wallets, task, difficulty), 'Should not find solution');
    });

    it('Should find solution for three node wallet address and lowest difficulty', () => {
        const wallets = randomNWallets(3);
        const task = generateTask(1);
        const difficulty = 1;

        const res = miner.solve(wallets, task, difficulty);

        const hashes = wallets.map(w => abi.soliditySHA3(['address', 'uint256'], [w, task]).toString('hex')).sort((h1, h2) => h1.localeCompare(h2));
        const solutionHash = abi.soliditySHA3(['uint256', 'uint256', 'uint256'], hashes.map(h => new BN(h, 16))).toString('hex');

        assert.isNotFalse(res, 'Should find solution');
        assert.equal(res.task, task.toString('hex'), 'Task should be same as given');
        assert.equal(res.nodeIdentifiers.length, 3, 'Solution should contain three addresses');
        assert.equal(res.solutionHash, solutionHash, 'Solution hash should be correct');
        assert.include(res.nodeIdentifiers, wallets[0].toString('hex').padStart(40, '0'), 'Solution should contain first given wallet');
        assert.include(res.nodeIdentifiers, wallets[1].toString('hex').padStart(40, '0'), 'Solution should contain second given wallet');
        assert.include(res.nodeIdentifiers, wallets[2].toString('hex').padStart(40, '0'), 'Solution should contain third given wallet');
    });

    it('Should find solution on position 26 for fixed wallet addresses on lowest difficulty', () => {
        const w1 = '0000000000000000000000000000000000000000';
        const w2 = '0000000000000000000000000000000000000001';
        const w3 = '0000000000000000000000000000000000000002';

        const wallets = [
            new BN(w1, 16),
            new BN(w2, 16),
            new BN(w3, 16),
        ];

        const task = new BN('a', 16);

        //                           a
        // be89b5c9260c075603ce22549ea4a056c4597c71efb30960e321a68c74d4d187
        //                           ^
        const hashes = wallets.map(w => abi.soliditySHA3(['address', 'uint256'], [w, task]).toString('hex')).sort((h1, h2) => h1.localeCompare(h2));
        const realHash = abi.soliditySHA3(['uint256', 'uint256', 'uint256'], hashes.map(h => new BN(h, 16))).toString('hex');

        const difficulty = 1;

        const res = miner.solve(wallets, task, difficulty);

        assert.equal(res.shift, 37, 'Shift should be 37');
        assert.equal(res.solutionHash, realHash, 'Hash should be correct');
        assert.equal(res.nodeIdentifiers.length, 3, 'Solution should contain three addresses');
        assert.equal(res.nodeIdentifiers[0], w1, 'First solution hash should be correct');
        assert.equal(res.nodeIdentifiers[1], w2, 'Second solution hash should be correct');
        assert.equal(res.nodeIdentifiers[2], w3, 'Third solution hash should be correct');
        assert.equal(res.task, task.toString('hex'), 'Task should be equal to given');
    });
});
