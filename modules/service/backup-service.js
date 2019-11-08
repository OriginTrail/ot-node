const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const Models = require('../../models');

class BackupService {
    constructor() {
        this.keynameMap = new Map();
        this.keynameMap.set('kademlia-identity', ['../config/DCG/identity-test.json', '../config/DCG/kademlia-test.crt', '../config/DCG/kademlia-test.key']);
        this.keynameMap.set('node-config', ['config/config-test.json']);

        this.pathMap = new Map();
        this._initializePathMap();
        this.backupPath = 'Backup';

        if (argv.configDir) {
            Models.sequelize.options.storage = path.join(argv.configDir, 'system.db');
        }
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

    async checkFileInfo(filename) {
        const configInfo = await Models.node_data.find({ where: { key: filename } });
        return configInfo;
    }

    async updateFileInfo(timestamp, filename) {
        await Models.node_data.update(
            {
                value: timestamp,
            },
            {
                where: {
                    key: filename,
                },
            },
        );
    }

    createNewBackup(timestamp, keyname) {
        fs.mkdirSync(`${this.backupPath}/${keyname}/${timestamp}`, (err) => {
            if (err) throw err;
        });
        for (const path of this.keynameMap.get(keyname)) {
            const filename = this.extractNameFromPath(path);
            fs.copyFile(path, `${this.backupPath}/${keyname}/${timestamp}/${filename}`, (err) => {
                if (err) throw err;
            });
        }
    }

    async checkForModification(keyname) {
        let max_timestamp = -1;
        for (const path of this.keynameMap.get(keyname)) {
            const filename = this.extractNameFromPath(path);
            const stat = fs.statSync(path);
            // eslint-disable-next-line no-await-in-loop
            const configInfo = await this.checkFileInfo(filename);
            // console.log(filename);

            const modificationTime = new Date(stat.mtime).getTime();
            const previousModificationTime = configInfo.value;

            if (modificationTime > previousModificationTime) {
                if (modificationTime > max_timestamp) {
                    max_timestamp = modificationTime;
                }
            }
        }
        return max_timestamp;
    }

    async handleModification(keyname) {
        const timestamp = await this.checkForModification(keyname);
        if (timestamp > -1) {
            for (const path of this.keynameMap.get(keyname)) {
                const filename = this.extractNameFromPath(path);
                // eslint-disable-next-line no-await-in-loop
                await this.updateFileInfo(timestamp, filename);
            }
            this.createNewBackup(new Date(timestamp).toISOString(), keyname);
            console.log(`Modification have occurred in ${keyname}`);
        } else {
            console.log(`There was no modification in ${keyname}`);
        }
    }

    async run() {
        const promises = [];
        this.keynameMap.forEach((value, key) => {
            promises.push(this.handleModification(key));
        });
        await Promise.all(promises);
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
