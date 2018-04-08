<?php $__container->servers(['dc' => ['root@167.99.202.146'], 'dh' => ['root@178.62.44.108'], 'localhost' => '127.0.0.1' ]); ?>

<?php $__container->startMacro('reset-all'); ?>
reset
dc-db
dh-db
<?php $__container->endMacro(); ?>

<?php $__container->startTask('push', ['on' => 'localhost']); ?>
git add --all
git commit -m"deploy"
git push dc refactoring
git push dh refactoring
<?php $__container->endTask(); ?>

<?php $__container->startTask('reset, ['on' => ['dc', 'dh'], 'parallel' => true]); ?>
su ot
cd ~/ot-node
rm -f modules/Database/system.db
touch modules/Database/system.db
node_modules/.bin/sequelize db:migrate
node_modules/.bin/sequelize db:seed:all
// rm -rf keys/*
<?php $__container->endTask(); ?>

<?php $__container->startTask('dc-db', ['on' => 'dc']); ?>
sqlite3 modules/Database/system.db 'UPDATE node_config SET value="167.99.202.146" WHERE key="node_rpc_ip"'
<?php $__container->endTask(); ?>

<?php $__container->startTask('dh-db', ['on' => 'dh']); ?>
sqlite3 modules/Database/system.db 'UPDATE node_config SET value="178.62.44.108" WHERE key="node_rpc_ip"'
sqlite3 modules/Database/system.db 'UPDATE node_config SET value=\"["https://167.99.202.146:5278/#44cd40efdb5481ad27ed80ece9121c02fce3bc9f"]\" WHERE key="network_bootstrap_nodes"'
<?php $__container->endTask(); ?>

<?php $__container->startTask('foo', ['on' => 'dc']); ?>
su ot
cd ~/ot-node
npm start
<?php $__container->endTask(); ?>