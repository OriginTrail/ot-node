Installs the V6 Beta Stage 1 Node

**UPCOMING FEATURE: SSL**

1. Visit [this link](https://www.ontotext.com/products/graphdb/graphdb-free/) and create an account. They will email you a link to download GraphDB. Look for the sentence (with the download link) that says:

> "If you have issues running executable files on your machine, you may also try GraphDB as a stand-alone distributive."

Click the link that says **GraphDB as a stand-alone distributive** in this sentence and download the file.

Get this file into the /root directory on the server. Just leave it as a zip file. The installer script will unzip it and install it as part of the process.

2. Login to the server as root. You __cannot__ use sudo and run this script. The command "npm install" __will__ fail.

3. Execute **one** of the following commands depending on if you have cloned the ot-node repo:

**If the repo is not cloned yet:**
```
apt install git -y && cd /root && git clone https://github.com/OriginTrail/ot-node && cd ot-node && git checkout v6/release/testnet && installer/installer.sh
```

**If you have already cloned the ot-node repo:**
```
/root/ot-node/installer/installer.sh
```
