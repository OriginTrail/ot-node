const fs = require('fs');
const AWS = require('aws-sdk');
const { execSync } = require('child_process');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const { lstatSync, readdirSync } = require('fs');
const { join } = require('path');


if (!argv.config) {
    argv.config = '.origintrail_noderc';
}

if (!argv.configDir) {
    argv.configDir = '../data/';
}

if (!argv.certs) {
    argv.certs = '../certs/';
}

if (!argv.backup_directory) {
    argv.backup_directory = '../backup/';
}

if (!argv.certs) {
    argv.certs = '../certs/';
}

if (!argv.aws_access_key_id) {
    throw Error('Please provide AWS access key id.');
}

if (!argv.aws_secret_access_key) {
    throw Error('Please provide AWS secret key.');
}

if (!argv.aws_bucket_name) {
    throw Error('Please provide AWS bucket name.');
}

try {
    const s3 = new AWS.S3({
        accessKeyId: argv.aws_access_key_id,
        secretAccessKey: argv.aws_secret_access_key,
    });

    execSync(`node backup.js --config=${argv.config} --configDir=${argv.configDir} --backup_directory=${argv.backup_directory}`, { stdio: 'inherit' });

    const isDirectory = source => lstatSync(source).isDirectory();
    const getDirectories = source =>
        readdirSync(source).map(name => join(source, name)).filter(isDirectory);
    const latest_backup = getDirectories(argv.backup_directory).sort().reverse()[0];
    fs.unlinkSync(`${latest_backup}/identity.json`);

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
                        });
                    } else {
                        throw err;
                    }
                });
        });
    };

    uploadDir(argv.backup_directory, argv.aws_bucket_name);
} catch (e) {
    console.error(e);
}

