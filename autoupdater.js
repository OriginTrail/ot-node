const { exec } = require('child_process');
const request = require('request');
const fs = require('fs');
var Zip = require('machinepack-zip');

process.once('message', async ([options]) => {
    console.log('STIGLE OPCIJE');
    console.log(options);
    const filename = `https://github.com/${options.repo}/archive/${options.branch}.zip`;
    console.log(`Downloading update: ${filename} ...`);
    const response = await request(filename);
    const filestream = fs.createWriteStream('update.zip');
    response.pipe(filestream);

    filestream.on('finish', () => {
        console.log('Download complete');
        console.log('Extracting update...');

        Zip.unzip({
            source: 'update.zip',
            destination: '..',
        }).exec({
            error(err) {
                console.log('-.-');
                console.log(err);
            },

            success() {
                console.log('Update extraction complete');
                console.log(`Moving update to directory ${options.version}...`);

                exec(`mv ../ot-node-develop ../${options.version}`, (err, stdout, stderr) => {
                    if (err) {
                        console.log(err);
                        return;
                    }

                    console.log(`Update has been moved to directory ${options.version}`);
                    console.log('Migrating node modules...');

                    exec(`cp -r ./node_modules ../${options.version}`, (err, stdout, stderr) => {
                        if (err) {
                            console.log(err);
                            return;
                        }

                        console.log('Node modules migrated');
                        console.log('Installing new node modules');

                        exec(`cd ../${options.version} && npm install`, (err, stdout, stderr) => {
                            if (err) {
                                console.log(err);
                                return;
                            }

                            console.log('npm modules have been installed');
                            console.log('Migrating node configuration');

                            exec(`cp -r ./data ../${options.version} && cp -r ./dh1-config ../${options.version} && cp .env ../../${options.version}`, (err, stdout, stderr) => {
                                if (err) {
                                    console.log(err);
                                    return;
                                }

                                console.log('Configuration migration complete');
                            });
                        });
                    });
                });
            },
        });
    });

});
