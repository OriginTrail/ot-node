const AWS = require('aws-sdk');
const async = require('async');
const fs = require('fs');
const path = require('path');

/**
 * Import related utilities
 */
class AWSService {
    /**
     * Creates a new instance of AWS service
     * @param AWSAccessKeyId any
     * @param AWSSecretAccessKey any
     */
    constructor(AWSAccessKeyId, AWSSecretAccessKey) {
        this.s3 = new AWS.S3({
            accessKeyId: AWSAccessKeyId,
            secretAccessKey: AWSSecretAccessKey,
        });
    }

    /**
     * Uploads a file larger than sizeLimit using different multiPartUpload feature
     * @param bucketName
     * @param absoluteFilePath
     * @param bucketPath
     * @param fileSizeInBytes
     * @param sizeLimit
     * @param resolve
     * @param reject
     */
    uploadMultipart(
        bucketName, absoluteFilePath, bucketPath, fileSizeInBytes, sizeLimit,
        resolve, reject,
    ) {
        this.s3.createMultipartUpload(
            { Bucket: bucketName, Key: bucketPath },
            (mpErr, multipart) => {
                if (!mpErr) {
                    const partSize = sizeLimit;
                    const parts = Math.ceil(fileSizeInBytes / partSize);
                    async.timesSeries(parts, (partNum, next) => {
                        const rangeStart = partNum * partSize;
                        const end = Math.min(rangeStart + partSize, fileSizeInBytes);

                        console.log(`Upload in progress (${(partNum / parts).toFixed(2)}%): ${path.basename(absoluteFilePath)} -> ${bucketName}`);

                        partNum += 1;
                        async.retry((retryCb) => {
                            const buffer = Buffer.alloc(end - rangeStart);
                            const fd = fs.openSync(absoluteFilePath, 'r');
                            const bytes = fs.readSync(fd, buffer, 0, end - rangeStart, rangeStart);
                            this.s3.uploadPart({
                                Body: buffer,
                                Bucket: bucketName,
                                Key: bucketPath,
                                PartNumber: partNum,
                                UploadId: multipart.UploadId,
                            }, (err, mData) => {
                                retryCb(err, mData);
                            });
                        }, (err, data) => {
                            next(err, { ETag: data.ETag, PartNumber: partNum });
                        });
                    }, (err, dataPacks) => {
                        this.s3.completeMultipartUpload({
                            Bucket: bucketName,
                            Key: bucketPath,
                            MultipartUpload: {
                                Parts: dataPacks,
                            },
                            UploadId: multipart.UploadId,
                        }, (err, data) => {
                            if (err) {
                                console.error(`Upload FAILED: ${path.basename(absoluteFilePath)} -> ${bucketName}`);
                                reject(err);
                            } else {
                                console.log(`Upload complete: ${path.basename(absoluteFilePath)} -> ${bucketName}`);
                                resolve(data);
                            }
                        });
                    });
                } else {
                    reject(mpErr);
                }
            },
        );
    }

    /**
     * Uploads a file to AWS bucket
     * @param bucketName
     * @param absoluteFilePath
     * @param bucketPath
     * @param stat
     * @param sizeLimit
     */
    uploadFile(bucketName, absoluteFilePath, bucketPath, stat, sizeLimit = 1024 * 1024 * 0.1) {
        return new Promise((resolve, reject) => {
            try {
                const fileSizeInBytes = stat.size;
                async.retry(() => {
                    if (fileSizeInBytes < sizeLimit) {
                        this.s3.putObject({
                            Bucket: bucketName,
                            Key: bucketPath,
                            Body: fs.readFileSync(absoluteFilePath),
                        }, (err, data) => {
                            if (err) {
                                console.error(`Upload FAILED: ${path.basename(absoluteFilePath)} -> ${bucketName}`);
                                reject(err);
                            } else {
                                console.log(`Upload complete: ${path.basename(absoluteFilePath)} -> ${bucketName}`);
                                resolve(data);
                            }
                        });
                    } else {
                        this.uploadMultipart(
                            bucketName, absoluteFilePath, bucketPath, fileSizeInBytes, sizeLimit,
                            resolve, reject,
                        );
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async emptyDirectory(bucket, dir) {
        const listParams = {
            Bucket: bucket,
            Prefix: dir,
        };

        const listedObjects = await this.s3.listObjectsV2(listParams).promise();

        if (listedObjects.Contents.length === 0) return;

        const deleteParams = {
            Bucket: bucket,
            Delete: { Objects: [] },
        };

        listedObjects.Contents.forEach(({ Key }) => {
            deleteParams.Delete.Objects.push({ Key });
        });

        await this.s3.deleteObjects(deleteParams).promise();

        if (listedObjects.IsTruncated) await this.emptyS3Directory(bucket, dir);
    }
}

module.exports = AWSService;
