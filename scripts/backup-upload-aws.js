const fs = require('fs');
const AWSService = require('../modules/service/aws-service');
const { execSync } = require('child_process');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach((name) => {
        const filePath = path.join(currentDirPath, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

if (!argv.config) {
    argv.config = '.origintrail_noderc';
}

if (!argv.configDir) {
    argv.configDir = '../data/';
}

if (!argv.backupDirectory) {
    argv.backupDirectory = '../backup/';
}

if (!argv.AWSAccessKeyId) {
    throw Error('Please provide AWS access key id.');
}

if (!argv.AWSSecretAccessKey) {
    throw Error('Please provide AWS secret key.');
}

if (!argv.AWSBucketName) {
    throw Error('Please provide AWS bucket name.');
}

try {
    console.log('Starting backup process. This might take several minutes.');
    const output = execSync(`node ${__dirname}/backup.js --config=${argv.config} --configDir=${argv.configDir} --backup_directory=${argv.backupDirectory}`).toString();
    console.log(output);
    if (output.includes('Backup process complete')) {
        const backupTimestamp = `${argv.backupDirectory}/${path.basename(/Creating (.*) directories.../g.exec(output)[1])}`;
        console.log(`Backup directory is ${path.basename(backupTimestamp)}`);
        const configFile = JSON.parse(fs.readFileSync(`${backupTimestamp}/.origintrail_noderc`));
        console.log('Removing private key from the config file...');
        delete configFile.node_private_key;

        let backupName = 'otnode_localhost';
        if (configFile.network.hostname) {
            backupName = backupName.replace('localhost', configFile.network.hostname);
        } else if (configFile.node_wallet) {
            backupName = backupName.replace('localhost', configFile.node_wallet);
        }
        fs.writeFileSync(`${backupTimestamp}/.origintrail_noderc`, JSON.stringify(configFile));

        if (fs.existsSync(`${argv.backupDirectory}/${backupName}`)) {
            execSync(`rm -rf ${argv.backupDirectory}/${backupName}`);
        }
        fs.mkdirSync(`${argv.backupDirectory}/${backupName}`);
        fs.renameSync(`${argv.backupDirectory}/${path.basename(backupTimestamp)}`, `${argv.backupDirectory}/${backupName}/${path.basename(backupTimestamp)}`);
        console.log('Files are ready for upload.');

        console.log('Connecting to AWS S3 bucket...');
        const aws = new AWSService(argv.AWSAccessKeyId, argv.AWSSecretAccessKey);

        const promises = [];
        walkSync(`${argv.backupDirectory}/${backupName}`, async (filePath, stat) => {
            const [, fileBaseName] = filePath.split(path.basename(backupTimestamp));
            const bucketPath = `${backupName}/${path.basename(backupTimestamp)}/${fileBaseName.substring(1)}`;
            promises.push(aws.uploadFile(argv.AWSBucketName, filePath, bucketPath, stat));
        });

        Promise.all(promises).then(() => {
            console.log('***********************************************');
            console.log('*****                                     *****');
            console.log('***        Upload process complete!         ***');
            console.log('*****                                     *****');
            console.log('***********************************************');

            if (fs.existsSync(`${argv.backupDirectory}/${backupName}/${path.basename(backupTimestamp)}`)) {
                execSync(`rm -rf ${argv.backupDirectory}/${backupName}/${path.basename(backupTimestamp)}`);
            }
        }).catch(async (err) => {
            console.log('***********************************************');
            console.log('*****                                     *****');
            console.log('***        Upload process FAILED!           ***');
            console.log('*****                                     *****');
            console.log('***********************************************');

            console.error(`Error: ${err.message}`);
            console.log('Please contact support for alternative instructions on uploading the backup of your node');

            await aws.emptyDirectory(argv.AWSBucketName, `${backupName}/${path.basename(backupTimestamp)}/`);
            if (fs.existsSync(`${argv.backupDirectory}/${backupName}/${path.basename(backupTimestamp)}`)) {
                execSync(`rm -rf ${argv.backupDirectory}/${backupName}/${path.basename(backupTimestamp)}`);
            }
        });
    }
} catch (e) {
    console.error(e);
}
