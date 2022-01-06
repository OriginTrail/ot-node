# OT-KwallaBetaInstalla
Installs the V6 Beta Stage 1 Node

**UPCOMING FEATURE: SSL**

1. Visit [this link](https://www.ontotext.com/products/graphdb/graphdb-free/) and create an account. They will email you a link to download GraphDB. Look for the sentence (with the download link) that says:

> "If you have issues running executable files on your machine, you may also try GraphDB as a stand-alone distributive."

Click the link that says **GraphDB as a stand-alone distributive** in this sentence and download the file.

Get this file into the /root directory on the server. Just leave it as a zip file. My script will unzip it etc. We are working on how to get the zip file on the server easier.

2. Login to the server as root. You __cannot__ sudo and run this script for various reasons. The command "npm install" __will__ fail.

3. Execute the following command:

```
apt install git -y && git clone https://github.com/calr0x/OT-KwallaBetaInstalla.git && cd OT-KwallaBetaInstalla && ./installer.sh
```