const Utilities = require('../Utilities');
const { execSync } = require('child_process');

const fs = require('fs');
const path = require('path');

/**
 * Changes the arango password to a randomly generated one
 */
class M6LuksEncryptionMigration {
    constructor({
        config, log,
    }) {
        this.config = config;
        this.log = log;
        this.device = 'encryptedfs.img';
        this.mount = 'ot-node-encrypted';
    }

    /**
     * Run migration
     */
    async run() {
        try {
            const loop = execSync('losetup -f').toString();
            // todo what if there is no available loop devices
            execSync(`dd if=/dev/zero of=${this.device} bs=1M count=1024`);
            execSync(`cat <<EOF | fdisk ${this.device}
            g
            n
            
            
            w
            EOF`);
            execSync(`mkfs.ext4 ${this.device}`);
            execSync(`losetup /dev/${loop} ./${this.device}`);
            execSync('apt-get install cryptsetup');

            execSync(`cat <<EOF | cryptsetup luksOpen /dev/${loop} ${this.mount}
                      otnode
                      EOF`);
            execSync(`dd if=/dev/zero of=/dev/mapper/${this.mount}`);
            execSync(`mkfs.ext4 /dev/mapper/${this.mount}`);
            execSync(`mkdir /${this.mount}`);
            execSync(`mount /dev/mapper/${this.mount} /${this.mount}`);
            // todo check if the device is encrypted
            execSync(`umount /dev/mapper/${this.mount}`);
            execSync(`cryptsetup luksClose ${this.mount}`);
            return 0;
        } catch (error) {
            this.log.error('LUKS encryption migration failed!');
            this.log.error(error);
            return -1;
        }
    }

    /**
     * Run migration
     */
    async mountDevice() {
        try {
            let loop = execSync('losetup | grep \'encryptedfs.img\' | grep -o \'loop[0-9]\'').toString();
            if (!loop) {
                loop = execSync('losetup -f').toString();
                // todo what if there is no available loop devices
                // todo what if there is no virtual devices
                execSync(`losetup /dev/${loop} ./${this.device}`);
                execSync(`mount /dev/mapper/${this.mount} /${this.mount}`);
                execSync(`cat <<EOF | cryptsetup luksOpen /dev/${loop} ${this.mount}
                      otnode
                      EOF`);
            }
            return 0;
        } catch (error) {
            this.log.error('LUKS encryption migration failed!');
            this.log.error(error);
            return -1;
        }
    }
}

module.exports = M6LuksEncryptionMigration;



const m = new M6LuksEncryptionMigration({config: null, log: null});
m.mountDevice();