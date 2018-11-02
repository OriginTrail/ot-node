const BN = require('bn.js');
const abi = require('ethereumjs-abi');

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
function _generatePermutations(permutations, current, usedElements, elements, i, n) {
    if (i === n) {
        permutations.push(current.slice());
    } else {
        for (const element of elements) {
            if (usedElements.indexOf(element) === -1) {
                usedElements.push(element);
                current[i] = element;
                _generatePermutations(
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
 * Generate Solidity SHA3 hash for single permutation of three wallets
 * @param permutation
 * @returns {*}
 * @private
 */
function _generateHash(permutation) {
    return abi.soliditySHA3(
        ['address', 'address', 'address'],
        [new BN(permutation[0], 16), new BN(permutation[1], 16), new BN(permutation[2], 16)],
    ).toString('hex');
}

/**
 * Check if permutation contains task solution
 * @param permutation
 * @param task
 * @returns {number}
 * @private
 */
function _solutionIndex(permutation, task) {
    const hex = _generateHash(permutation);
    return hex.indexOf(task);
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
function _findSolution(wallets, candidate, i, k, task) {
    if (i === k) {
        const permutations = [];
        _generatePermutations(permutations, [], [], candidate, 0, k);

        for (const permutation of permutations) {
            const res = _solutionIndex(permutation, task);

            if (res !== -1) {
                const hash = _generateHash(permutation);

                return {
                    nodeIdentifiers: permutation,
                    solutionHash: hash,
                    shift: 64 - res - task.length,
                    task,
                };
            }
        }
        return false;
    }
    for (const wallet of wallets) {
        if (i === 0 || wallet > candidate[i - 1]) {
            candidate[i] = wallet;
            const res = _findSolution(wallets, candidate, i + 1, k, task);
            if (res) {
                return res;
            }
        }
    }
    return false;
}

/**
     * Wrapper function for solution finding function
     * @param wallets
     * @param task
     * @returns {solution|false}
     * @private
     */
function _solve(wallets, task) {
    return _findSolution(wallets, [], 0, 3, task);
}

/**
     * Solve PoW task
     * @param {BN[]} wallets
     * @param {BN} task
     * @param difficulty
     */
function solve(wallets, task, difficulty) {
    const walletsArr = wallets.map(walletBn => walletBn.toString('hex').padStart(40, '0'));
    const taskStr = task.toString('hex').padStart(difficulty, '0');
    return _solve(walletsArr, taskStr);
}

module.exports = {
    solve: (wallets, task, difficulty) => solve(wallets, task, difficulty),
};
