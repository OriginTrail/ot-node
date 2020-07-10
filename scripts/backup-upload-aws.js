const fs = require('fs');
const AWS = require('aws-sdk');
const { execSync } = require('child_process');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const { lstatSync, readdirSync } = require('fs');
const { join } = require('path');
const async = require('async');


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

const s3 = new AWS.S3({
    accessKeyId: argv.AWSAccessKeyId,
    secretAccessKey: argv.AWSSecretAccessKey,
});


function uploadMultipart(absoluteFilePath, fileName, uploadCb) {
    s3.createMultipartUpload({ Bucket: argv.AWSBucketName, Key: fileName }, (mpErr, multipart) => {
        if (!mpErr) {
            var stats = fs.statSync(absoluteFilePath);
            var fileSizeInBytes = stats.size;
            var partSize = 1024 * 1024 * 100;
            var parts = Math.ceil(fileSizeInBytes / partSize);
            var partNum = 1;
            async.timesSeries(parts, (partNum, next) => {
                var rangeStart = partNum * partSize;
                var end = Math.min(rangeStart + partSize, fileSizeInBytes);

                console.log('uploading ', fileName, ' % ', (partNum / parts).toFixed(2));

                partNum += 1;
                async.retry((retryCb) => {
                    var buffer = Buffer.alloc(end - rangeStart);
                    var fd = fs.openSync(absoluteFilePath, 'r');
                    const bytes = fs.readSync(fd, buffer, 0, end - rangeStart, rangeStart);
                    s3.uploadPart({
                        Body: buffer, // fileData.slice(rangeStart, end),
                        Bucket: argv.AWSBucketName,
                        Key: fileName,
                        PartNumber: partNum,
                        UploadId: multipart.UploadId,
                    }, (err, mData) => {
                        retryCb(err, mData);
                    });
                }, (err, data) => {
                    // console.log(data);
                    next(err, { ETag: data.ETag, PartNumber: partNum });
                });
            }, (err, dataPacks) => {
                s3.completeMultipartUpload({
                    Bucket: argv.AWSBucketName,
                    Key: fileName,
                    MultipartUpload: {
                        Parts: dataPacks,
                    },
                    UploadId: multipart.UploadId,
                }, (err, data) => {
                    if (err) {
                        console.log('An error occurred while completing the multipart upload');
                        console.log(err);
                    } else {
                        console.log('done');
                    }
                });
            });
        } else {
            console.log(mpErr);
            uploadCb(mpErr);
        }
    });
}

function uploadFile(absoluteFilePath, bucketPath, uploadCb) {
    var stats = fs.statSync(absoluteFilePath);
    var fileSizeInBytes = stats.size;

    try {
        async.retry(async (retryCb) => {
            if (fileSizeInBytes < (1024 * 1024 * 100)) {
                s3.putObject({
                    Bucket: argv.AWSBucketName,
                    Key: bucketPath,
                    Body: fs.readFileSync(absoluteFilePath),
                }, (err, data) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(`Successfully uploaded ${bucketPath} to ${argv.AWSBucketName}`);
                    }
                });
            } else {
                uploadMultipart(absoluteFilePath, bucketPath, uploadCb);
            }
        }, uploadCb);
    } catch (e) {
        console.log(e);
    }
}

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

function isEmpty(path) {
    return fs.readdirSync(path).length === 0;
}

try {
    if (fs.existsSync(argv.backupDirectory) && !isEmpty(argv.backupDirectory)) {
        console.log('Backup directory is not empty. Removing content...');
        execSync(`rm -rf ${argv.backupDirectory}`);
    }

    execSync(`node ${__dirname}/backup.js --config=${argv.config} --configDir=${argv.configDir} --backup_directory=${argv.backupDirectory}`, { stdio: 'inherit' });

    const isDirectory = source => lstatSync(source).isDirectory();
    const getDirectories = source =>
        readdirSync(source).map(name => join(source, name)).filter(isDirectory);
    const backupTimestamp = getDirectories(argv.backupDirectory).sort()[0];
    console.log(`Backup directory is ${backupTimestamp}`);
    console.log('Removing private key from config file...');
    const configFile = JSON.parse(fs.readFileSync(`${backupTimestamp}/.origintrail_noderc`));
    let node_wallet = `otnode_${configFile.node_wallet}`;
    if (!node_wallet) { node_wallet = 'otnode_localhost'; }
    delete configFile.node_private_key;
    fs.writeFileSync(`${backupTimestamp}/.origintrail_noderc`, JSON.stringify(configFile));

    if (!fs.existsSync(`${argv.backupDirectory}/${node_wallet}`)) { fs.mkdirSync(`${argv.backupDirectory}/${node_wallet}`); }
    fs.renameSync(`${argv.backupDirectory}/${path.basename(backupTimestamp)}`, `${argv.backupDirectory}/${node_wallet}/${path.basename(backupTimestamp)}`);
    console.log('Backup files are ready for upload.');

    console.log('Connecting to AWS S3 bucket...');
    walkSync(argv.backupDirectory, async (filePath, stat) => {
        if (filePath.includes('.DS')) { return; }
        const bucketPath = `${node_wallet}/${path.basename(backupTimestamp)}${filePath.split(path.basename(backupTimestamp))[1]}`;
        uploadFile(filePath, bucketPath, () => {
            console.log(`Successfully uploaded ${filePath}`);
            // execSync(`rm ${filePath}`);
        });
    });
} catch (e) {
    console.error(e);
}