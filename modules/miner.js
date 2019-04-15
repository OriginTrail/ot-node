const BN = require('bn.js');
const abi = require('ethereumjs-abi');

var num_tries = 0;

/**
 * Generate Solidity SHA3 hash for single permutation of three wallets
 * @param permutation
 * @returns {*}
 * @private
 */
function _generateHash(permutation) {
    return abi.soliditySHA3(
        ['uint256', 'uint256', 'uint256'],
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
    const hash = _generateHash(permutation);
    const index = hash.indexOf(task);
    return {
        hash,
        index,
    };
}

function _findSolution(wallets, candidates, i, k, task) {
    if (i === k) {
        num_tries += 1;
        const { index, hash } = _solutionIndex(candidates.map(i => wallets[i].hash), task);
        if (index !== -1) {
            return {
                nodeIdentifiers: candidates.map(i => wallets[i].wallet),
                hashes: candidates.map(i => wallets[i].hash),
                solutionHash: hash,
                shift: 64 - index - task.length,
                task,
                num_tries,
            };
        }
        return false;
    }

    let j = 0;
    let n = wallets.length - 2;

    if (i > 0) {
        j = candidates[i - 1] + 1;

        if (i === 1) {
            n += 1;
        } else {
            n += 2;
        }
    }


    for (; j < n; j += 1) {
        candidates[i] = j;
        const result = _findSolution(wallets, candidates, i + 1, k, task);
        if (result) {
            return result;
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
    num_tries = 0;
    const walletsArr = wallets.map((walletBn) => {
        const wallet = walletBn.toString('hex').padStart(40, '0');
        const hash = abi.soliditySHA3(['address', 'uint256'], [walletBn, task]).toString('hex');

        return {
            wallet,
            hash,
        };
    });

    walletsArr.sort((a, b) => a.hash.localeCompare(b.hash));
    const taskStr = task.toString('hex').padStart(difficulty, '0');
    return _solve(walletsArr, taskStr);
}

module.exports = {
    solve: (wallets, task, difficulty) => solve(wallets, task, difficulty),
};
