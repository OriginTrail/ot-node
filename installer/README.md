Installs the V6 Beta Stage 1 Node

2. Login to the server as root. You __cannot__ use sudo and run this script. The command "npm install" __will__ fail.

3. Execute the following command:

```
apt install git -y && cd /root && wget https://raw.githubusercontent.com/OriginTrail/ot-node/v6/develop/installer/installer.sh && chmod +x installer.sh && . installer.sh
```

