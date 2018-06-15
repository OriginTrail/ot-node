const fs = require('fs');
const rimraf = require('rimraf');
const Duration = require('duration-js');
const exec = require('child_process').exec;

const d = new Date();
const dN = new Date(2018, 6, 24);
const todaysDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getMinutes()}`;
// const testDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate() -8}`;
// const pastDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate() - 7}`;


if (fs.existsSync('./db_backup')) {
    console.log('Database backup directory already exists');
} else {
    fs.mkdir('./db_backup', (err) => {
        if (err) {
            console.log('Error : ', err);
        }
    });
    console.log('Database backup directory is  made');
}

if (fs.existsSync('./db_backup/arango_db')) {
    console.log('Arango database directory already exists');
} else {
    fs.mkdir('./db_backup/arango_db', (err) => {
        if (err) {
            console.log('Error :', err);
        }
    });
    console.log('Arango database backup directory made');
}

if (fs.existsSync('./db_backup/sqllite_db')) {
    console.log('SqlLite database directory already exists');
} else {
    fs.mkdir('./db_backup/sqllite_db', (err) => {
        if (err) {
            console.log('Error :', err);
        }
    });
    console.log('SqlLite database backup directory made');
}


if (fs.existsSync(`./db_backup/sqllite_db/${todaysDate}-sqlbackup.db`)) {
    console.log(`SqlLite database backup for ${todaysDate} already exist`);
} else {
    console.log('Backup of sqlLite database does not exist');
    console.log('Creating one');

    fs.copyFile('./modules/Database/system.db', `./db_backup/sqllite_db/${todaysDate}-sqlbackup.db`, (err) => {
        if (err) throw err;
        console.log(`Backup od sqlLite database for ${todaysDate} was created`);
    });
}


if (fs.existsSync(`./db_backup/arango_db/arango-db-${todaysDate}`)) {
    console.log(`Arango database backup directory for  ${todaysDate} already exist`);
} else {
    exec(
        'arangoexport --type json  --collection ot_edges --collection ot_vertices  --server.database origintrail --overwrite true --graph-name origintrail --output-directory \'arango-db\' --server.password \'\'',
        (error, stdout, stderr) => {
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
            if (error !== null) {
                console.log(`exec error: ${error}`);
            }
        },
    );

    setTimeout(() => {
        console.log('Backup of Arango does not exist');
        console.log('Creating one');

        fs.rename('./arango-db', `./db_backup/arango_db/arango-db-${todaysDate}`, (err) => {
            if (err) throw err;
            console.log(`Backup od Arango database for ${todaysDate} was created`);
        });
    }, 1000);
}

setTimeout(() => {
    const files = fs.readdirSync('./db_backup/sqllite_db');
    var i;
    for (i = 0; i < files.length; i++) {
        const stats = fs.statSync(`./db_backup/sqllite_db/${files[i]}`);

        const ctime = new Date((stats.ctime));

        const curTime = new Date();

        const curTimestamp = curTime.getTime();

        const timeStamp = ctime.getTime();


        if ((curTimestamp - (7 * 24 * 60 * 60 * 100)) > timeStamp) {
            rimraf(`./db_backup/sqllite_db/${files[i]}`, () => {
                console.log('Successfully deleted backup of sqlLite  database that is more than 6 days old ');
            });
        } else {
            console.log('There is no backup of sqlLite  database that is more than 7 days old');
        }
    }
}, 1000);

setTimeout(() => {
    const files = fs.readdirSync('./db_backup/arango_db');
    var i;
    for (i = 0; i < files.length; i++) {
        const stats = fs.statSync(`./db_backup/arango_db/${files[i]}`);

        const ctime = new Date((stats.ctime));

        const curTime = new Date();

        const curTimestamp = curTime.getTime();

        const timeStamp = ctime.getTime();


        if ((curTimestamp - (7 * 24 * 60 * 60 * 100)) > timeStamp) {
            rimraf(`./db_backup/arango_db/${files[i]}`, () => {
                console.log('Successfully deleted backup of arango  database that is more than 6 days old ');
            });
        } else {
            console.log('There is no backup of arango  database that is more than 7 days old ');
        }
    }
}, 1000);
