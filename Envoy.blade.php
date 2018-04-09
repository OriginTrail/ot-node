@servers(['dc' => ['root@167.99.202.146'], 'dh' => ['root@178.62.44.108'], 'localhost' => '127.0.0.1' ])

@story('reset-all')
push
reset
dc-db
dh-db
@endstory

@task('push', ['on' => 'localhost'])
git add --all
git commit -m"deploy"
git push dc refactoring
git push dh refactoring
@endtask

@task('reset', ['on' => ['dc', 'dh'], 'parallel' => true])
rm -f /home/ot/ot-node/modules/Database/system.db
touch /home/ot/ot-node/modules/Database/system.db
# chown 777 /home/ot/ot-node/modules/Database/system.db
cd /home/ot/ot-node
node_modules/.bin/sequelize db:migrate
node_modules/.bin/sequelize db:seed:all
rm -f data/peercache
rm -rf kad-storage/*
# rm -rf keys/*
@endtask

@task('dc-db', ['on' => 'dc'])
sqlite3 /home/ot/ot-node/modules/Database/system.db 'UPDATE node_config SET value="167.99.202.146" WHERE key="node_rpc_ip"'
sqlite3 /home/ot/ot-node/modules/Database/system.db "UPDATE node_config SET value='[\"94.189.153.23\"]'
WHERE key='remote_access_whitelist'"
@endtask

@task('dh-db', ['on' => 'dh'])
sqlite3 /home/ot/ot-node/modules/Database/system.db 'UPDATE node_config SET value="178.62.44.108" WHERE key="node_rpc_ip"'
sqlite3 /home/ot/ot-node/modules/Database/system.db "UPDATE node_config SET value='[\"https://167.99.202.146:5278/#b8eed150d20a9d5ec553c97104fbcf420c2c28c0\"]' WHERE key='network_bootstrap_nodes'"
sqlite3 /home/ot/ot-node/modules/Database/system.db 'UPDATE node_config SET value="0" WHERE
key="is_bootstrap_node"'
@endtask

@task('foo', ['on' => 'dc'])
su ot
cd ~/ot-node
npm start
@endtask