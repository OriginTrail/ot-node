const BN = require('bn.js');
const abi = require('ethereumjs-abi');

class Miner {
    /**
     * Wrapper function for solution finding function
     * @param wallets
     * @param task
     * @returns {solution|false}
     * @private
     */
    _solve(wallets, task) {
        return this._findSolution(wallets, [], 0, 3, task);
    }

    /**
     * Finds solution for given task and wallet array
     * @param wallets
     * @param candidate
     * @param i
     * @param k
     * @param task
     * @returns {*}
     * @private
     */
    _findSolution(wallets, candidate, i, k, task) {
        if (i === k) {
            const permutations = [];
            this._generatePermutations(permutations, [], [], candidate, 0, k);

            for (const permutation of permutations) {
                const res = this._hasSolution(permutation, task);

                if (res !== -1) {
                    const hash = this._generateHash(permutation);

                    return {
                        nodeIdentifiers: permutation, solutionHash: hash, shift: res, task,
                    };
                }
            }
            return false;
        }
        for (const wallet of wallets) {
            if (i === 0 || wallet > candidate[i - 1]) {
                candidate[i] = wallet;
                const res = this._findSolution(wallets, candidate, i + 1, k, task);
                if (res) {
                    return res;
                }
            }
        }
        return false;
    }

    /**
     * Generate all permutations for single combination
     * @param permutations
     * @param current
     * @param usedElements
     * @param elements
     * @param i
     * @param n
     * @private
     */
    _generatePermutations(permutations, current, usedElements, elements, i, n) {
        if (i === n) {
            permutations.push(current.slice());
        } else {
            for (const element of elements) {
                if (usedElements.indexOf(element) === -1) {
                    usedElements.push(element);
                    current[i] = element;
                    this._generatePermutations(
                        permutations,
                        current,
                        usedElements,
                        elements,
                        i + 1,
                        n,
                    );
                    usedElements.pop();
                }
            }
        }
    }

    /**
     * Check if permutation contains task solution
     * @param permutation
     * @param task
     * @returns {number}
     * @private
     */
    _hasSolution(permutation, task) {
        const hex = this._generateHash(permutation);
        return hex.indexOf(task);
    }

    /**
     * Generate Solidity SHA3 hash for single permutation of three wallets
     * @param permutation
     * @returns {*}
     * @private
     */
    _generateHash(permutation) {
        return abi.soliditySHA3(
            ['address', 'address', 'address'],
            [new BN(permutation[0], 16), new BN(permutation[1], 16), new BN(permutation[2], 16)],
        ).toString('hex');
    }

    /**
     * Solve PoW task
     * @param {BN[]} wallets
     * @param {BN} solution
     */
    solve(wallets, task) {
        const walletsArr = wallets.map(walletBn => walletBn.toString('hex').padStart(40, '0'));
        const taskStr = task.toString('hex');
        return this._solve(walletsArr, taskStr);
    }
}

module.exports = Miner;

// console.log(solutionMining(wallets, generatetask(3)));

process.once('message', ({ wallets, task }) => {
    const minerInstance = new Miner();

    const res = minerInstance.solve(wallets, task);
    process.send({ result: res });
});

process.once('SIGTERM', () => process.exit(0));
