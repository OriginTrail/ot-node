const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const BN = require('bn.js');
const abi = require('ethereumjs-abi');
const MinerTest = require('../../modules/Miner');

describe('PoW MinerTest ', () => {
    function digitToHex(digit) {
        if (digit < 10) {
            return digit.toString();
        }


        return String.fromCharCode((65 + digit) - 10);
    }

    function randomHexDigit() {
        return digitToHex(Math.floor(Math.random() * 100) % 16);
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
        const miner = new MinerTest();
        const wallets = randomNWallets(1);
        const task = generateTask(1);

        assert.isFalse(miner.solve(wallets, task), 'Should not find solution');
    });

    it('Should not find solution for two node wallet address', () => {
        const miner = new MinerTest();
        const wallets = randomNWallets(2);
        const task = generateTask(1);

        assert.isFalse(miner.solve(wallets, task), 'Should not find solution');
    });

    it('Should find solution for three node wallet address and lowest difficulty', () => {
        const miner = new MinerTest();
        const wallets = randomNWallets(3);
        const task = generateTask(1);

        const res = miner.solve(wallets, task);

        const solution = res.nodeIdentifiers.map(w => new BN(w, 16));

        const solutionHash = abi.soliditySHA3(['address', 'address', 'address'], solution).toString('hex');

        assert.isNotFalse(res, 'Should find solution');
        assert.equal(res.task, task.toString('hex'), 'Task should be same as given');
        assert.equal(res.nodeIdentifiers.length, 3, 'Solution should contain three addresses');
        assert.equal(res.solutionHash, solutionHash, 'Solution hash should be correct');
        assert.include(res.nodeIdentifiers, wallets[0].toString('hex').padStart(40, '0'), 'Solution should contain first given wallet');
        assert.include(res.nodeIdentifiers, wallets[1].toString('hex').padStart(40, '0'), 'Solution should contain second given wallet');
        assert.include(res.nodeIdentifiers, wallets[2].toString('hex').padStart(40, '0'), 'Solution should contain third given wallet');
    });

    it('Should find solution on position 17 for fixed wallet addresses on lowest difficulty', () => {
        const miner = new MinerTest();

        const w1 = '0000000000000000000000000000000000000000';
        const w2 = '0000000000000000000000000000000000000001';
        const w3 = '0000000000000000000000000000000000000002';

        const wallets = [
            new BN(w1, 16),
            new BN(w2, 16),
            new BN(w3, 16),
        ];

        const task = new BN('c50', 16);

        //                  c50
        // 2ecbc4bf1ece29099c50027601e0ed56e6c4cf41991352508337fe6836bd0b19
        //                  ^
        const realHash = abi.soliditySHA3(['address', 'address', 'address'], wallets).toString('hex');

        const res = miner.solve(wallets, task);

        assert.equal(res.shift, 17, 'Shift should be 17');
        assert.equal(res.solutionHash, realHash, 'Hash should be correct');
        assert.equal(res.nodeIdentifiers.length, 3, 'Solution should contain three addresses');
        assert.equal(res.nodeIdentifiers[0], w1, 'First solution hash should be correct');
        assert.equal(res.nodeIdentifiers[1], w2, 'Second solution hash should be correct');
        assert.equal(res.nodeIdentifiers[2], w3, 'Third solution hash should be correct');
        assert.equal(res.task, task.toString('hex'), 'Task should be equal to given');
    });
});
