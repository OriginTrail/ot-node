const fs = require('fs');
const rimraf = require('rimraf');

const d = new Date();
const dN = new Date(2018, 6, 24);
const todaysDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const pastDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate() - 7}`;


if (fs.existsSync('./db_backup')) {
    console.log('Database backup directory already exists');
} else {
    fs.mkdir('./db_backup', (err) => {
        if (err) {
            console.log('Error : ', err);
        } else {

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
        } else {
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
        } else {
        }
    });
    console.log('SqlLite database backup directory made');
}


const exec = require('child_process').exec;


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
    if (fs.existsSync(`./db_backup/arango_db/arango-db-${pastDate}`)) {
        rimraf(`./db_backup/arango_db/arango-db-${pastDate}`, () => {
            console.log('Successfully deleted backup of Arango  database that is more than 6 days old ');
        });
    } else {
        console.log('There is no backup of Arango database older than 6 days');
    }
    if (fs.existsSync(`./db_backup/sqllite_db/${pastDate}-sqlbackup.db`)) {
        rimraf(`./db_backup/sqllite_db/${pastDate}-sqlbackup.db`, () => {
            console.log('Successfully deleted backup of sqlLite  database that is more than 6 days old ');
        });
    } else {
        console.log('There is no backup of sqlLite database older than 6 days');
    }
}, 2000);
