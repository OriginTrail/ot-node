const fs = require('fs');
const path = require('path');

class BackupService {
    constructor() {
        this.keynameMap = new Map();
        this.keynameMap.set('kademlia-identity', ['../config/DCG/identity-test.json', '../config/DCG/kademlia-test.crt', '../config/DCG/kademlia-test.key']);
        this.keynameMap.set('node-config', ['config/config-test.json']);

        this.pathMap = new Map();
        this._initializePathMap();
        this.backupPath = 'Backup';
    }

    _initializePathMap() {
        this.keynameMap.forEach((value, _key) => {
            this._determinePaths(value);
        });
    }

    _determinePaths(paths) {
        for (const path of paths) {
            this.pathMap.set(this.extractNameFromPath(path), path);
        }
    }

    extractNameFromPath(path) {
        const n = path.lastIndexOf('/');
        return path.slice(n + 1);
    }

    restoreBackup(keyname, date) {
        const dirPath = path.join(this.backupPath, keyname, date);
        console.log(dirPath);
        fs.readdirSync(dirPath).forEach((f) => {
            const srcPath = path.join(dirPath, f);
            const isFile = fs.statSync(srcPath).isFile();
            if (isFile === true) {
                const destPath = this.pathMap.get(f);
                fs.copyFileSync(srcPath, destPath, (err) => {
                    if (err) throw err;
                });
            }
        });

        return 'ok';
    }

    getMap() {
        return this.keynameMap;
    }

    getBackupPath() {
        return this.backupPath;
    }
}

// const backupService = new BackupService();
module.exports = BackupService;

// backupService.restoreBackup('node-config', '1573209592562');
