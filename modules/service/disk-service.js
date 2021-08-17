const { execSync } = require('child_process');
const fs = require('fs');

const mapping = {
    total: 1,
    used: 2,
    free: 3,
};

class DiskService {
    getRootFolderInfo() {
        const output = execSync('df -Pk /');
        const parsed = output.toString('utf8').trim().split('\n').slice(1)
            .map(line => line.trim().split(/\s+(?=[\d/])/))[0];
        return {
            total: parsed[mapping.total],
            used: parsed[mapping.used],
            free: parsed[mapping.free],
        };
    }

    getFolderSize(path) {
        if (!this.folderExists(path) || !fs.lstatSync(path).isDirectory()) {
            throw Error('Provided path not directory');
        }
        const output = execSync(`du -shk ${path}`);
        const parsed = output.toString('utf8').trim().split(/\s+(?=[\d/])/);
        return parsed[0];
    }

    getFileSize(path) {
        if (!this.folderExists(path) || !fs.lstatSync(path).isFile()) {
            throw Error('Provided path not file');
        }
        const output = execSync(`du -shk ${path}`);
        const parsed = output.toString('utf8').trim().split(/\s+(?=[\d/])/);
        return parsed[0];
    }

    folderExists(path) {
        return fs.existsSync(path);
    }
}

module.exports = DiskService;
