#!/bin/bash
echo Running arango password update script...

FOLDERDIR=$1
echo Using ${FOLDERDIR} as node data folder

touch ${FOLDERDIR}/arango.txt
new_arango_password=$(openssl rand -base64 32)
echo Generated new arango password!

echo -n $new_arango_password > ${FOLDERDIR}/arango.txt
echo New arango password stored in ${FOLDERDIR}/arango.txt file

#cat ${FOLDERDIR}/arango.txt
#echo Generated new arango password: $new_arango_password

touch arango-password-script.js
echo 'require("@arangodb/users").replace("root", ARGUMENTS[0]);' > arango-password-script.js

echo Updating arango server password

supervisorctl stop arango
sed -i 's/authentication = true/authentication = false/g' /etc/arangodb3/arangod.conf
supervisorctl start arango

sleep 10s

/usr/bin/arangosh --server.password "" --javascript.execute arango-password-script.js ${new_arango_password}

supervisorctl stop arango
sed -i 's/authentication = false/authentication = true/g' /etc/arangodb3/arangod.conf
supervisorctl start arango

rm arango-password-script.js

n=0
timeout=60 # timeout value for startup
while [[ (-z `curl -H 'Authorization: Basic cm9vdDo=' -s 'http://'"$2"':'"$3"'/_api/version' `) && (n -lt timeout) ]] ; do
  echo -n "."
  sleep 1s
  n=$[$n+1]
done

if [[ n -eq timeout ]];
then
    echo "Could not start ArangoDB. Timeout reached."
    exit 1
fi

echo ""
echo "==================================================="
echo "====                                           ===="
echo "====   Arango password successfully updated!   ===="
echo "====                                           ===="
echo "==================================================="


