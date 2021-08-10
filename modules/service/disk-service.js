const { execSync } = require('child_process');
const fs = require('fs');

const mapping = {
    total: 1,
    used: 2,
    free: 3,
};

class DiskService {
    getDiskSpaceInfo(path = '/') {
        if (!fs.lstatSync(path).isDirectory()) {
            throw Error('Provided path not directory');
        }
        const output = execSync(`df -Pk ${path}`);
        const parsed = output.toString('utf8').trim().split('\n').slice(1)
            .map(line => line.trim().split(/\s+(?=[\d/])/))[0];
        return {
            total: parsed[mapping.total],
            used: parsed[mapping.used],
            free: parsed[mapping.free],
        };
    }
}

module.exports = DiskService;
