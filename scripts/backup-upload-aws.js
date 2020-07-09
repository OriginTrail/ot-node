const fs = require('fs');
const AWS = require('aws-sdk');
const { execSync } = require('child_process');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const { lstatSync, readdirSync } = require('fs');
const { join } = require('path');
const rimraf = require('rimraf');


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
    const s3 = new AWS.S3({
        accessKeyId: argv.AWSAccessKeyId,
        secretAccessKey: argv.AWSSecretAccessKey,
    });

    execSync(`node backup.js --config=${argv.config} --configDir=${argv.configDir} --backup_directory=${argv.backupDirectory}`, { stdio: 'inherit' });

    const isDirectory = source => lstatSync(source).isDirectory();
    const getDirectories = source =>
        readdirSync(source).map(name => join(source, name)).filter(isDirectory);
    const backupTimestamp = getDirectories(argv.backupDirectory).sort()[0];
    console.log(`Backup directory is ${backupTimestamp}`);
    console.log('Removing private key from config file...');
    const configFile = JSON.parse(fs.readFileSync(`${backupTimestamp}/.origintrail_noderc`));
    let { hostname } = `otnode_${configFile.network}`;
    if (!hostname) { hostname = 'otnode_localhost'; }
    delete configFile.node_private_key;
    fs.writeFileSync(`${backupTimestamp}/.origintrail_noderc`, JSON.stringify(configFile));

    if (!fs.existsSync(`${argv.backupDirectory}/${hostname}`)) { fs.mkdirSync(`${argv.backupDirectory}/${hostname}`); }
    fs.renameSync(`${argv.backupDirectory}/${path.basename(backupTimestamp)}`, `${argv.backupDirectory}/${hostname}/${path.basename(backupTimestamp)}`);

    console.log('Backup files are ready for upload.');
    const uploadDir = (s3Path, bucketName) => {
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

        walkSync(s3Path, async (filePath, stat) => {
            const bucketPath = filePath.substring(s3Path.length + 1);
            const params = { Bucket: bucketName, Key: bucketPath, Body: fs.readFileSync(filePath) };
            await s3.headObject({ Bucket: bucketName, Key: bucketPath })
                .promise().then(() => true, (err) => {
                    if (err.code === 'NotFound') {
                        s3.putObject(params, (err, data) => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log(`Successfully uploaded ${bucketPath} to ${bucketName}`);
                            }

                            rimraf(`${argv.backupDirectory}/${bucketPath}`, () => { console.log(`Successfully removed ${argv.backupDirectory}/${bucketPath}`); });
                        });
                    } else {
                        throw err;
                    }
                });
        });
    };

    console.log('Connecting to AWS S3 bucket...');
    uploadDir(argv.backupDirectory, argv.AWSBucketName);
} catch (e) {
    console.error(e);
}