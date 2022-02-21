Windows WSL Local Node Config Creation Tool
========================

**Run a single command to create node configuration files to enable running of a local network for ot-node development.**

This tool will generate configuration files for mulitple OriginTrail nodes, allowing you to run a multi node network locally.

**Note:** This tool is intended for creating development nodes only, running on **Windows Subsystem for Linux (WSL).** For MacOS and Linux, see [MacOS & Linux local network setup]([https://docs.origintrail.io/dkg-v6-upcoming-version/setting-up-your-development-environment#running-multiple-nodes-in-local).

## Prerequisites

* A Windows Subsystem for Linux (WSL) environment running Ubuntu 20.04, and configured for OT-Node development.
  * See document: **How to setup a Windows development environment** (currently in review)

Usage
=====

## 1. (Optional) Specify an existing Network Private Key 

By default, this script will generate a new network private key and node network id when run.

If you'd prefer to run your bootstrap node using an existing node network id, update the template file `bootstrap_node_template` to include the network private key for the node id you'd like to use: 

```json
{
    "network": {
        "privateKey": "CAAS4QQwggJdAgEAAoGBALi8aRb/F4QzgIu+dHaarjpTfVWP3iLumayul7MDunoYBbkg5FOBhq5i/M0p0J1sLMLXEPV/jlkKklVCOdsDdq/49rHT85fnHcQmkuOVas3HYr8ahigdVJkiYSgOZK25LVzNE0Mpa6Fa9lk2ze41YD56Xhw0LJQEqpZx6DHjvwpDAgMBAAECgYEAoiP0FNQGHulZLM4XyPWRL+4xdlSUgpJq3O5MhTmDhT/qXgdpf4WS4SJOgf/ucw0L6GL9JowzMyGdOCmtP/Y1R1WcUBireq/55+swdTy83k5ti6yljS31QUeSIDyF8efzZjGLwkW/J2eh+nFomKdm1IT6k3zvG6K9rFx4ttg1QcECQQDouurQNJWCk8I1DjrgOJ+g4dTDK3gDMPpvc5n2VVwJn1RH0Hh4cewz5VWAsm1NQnwlERAjP/sWwLDI8VLAyFDhAkEAyzUCaWcq0u2H/lfPFqUOwUI6nWsREqWdbCK+kifHCvc0FgYApcM5LLQfT9sc2777B5N/SwFzOruzMK3VD5XrowJANnavxwPXTVSY6WOoIZr+uF7BNN9yWYTXxsdN65j0TggsaX11A/LdLRPpW5HmBGOfu+jvVuB9OUjk1lGrZRQ74QJAHqJnMqyy8AmPLvDd73QCvW/WllTFxiHhkaPLRw1oGzJZT9in0FWWEP82mTtXJmmsPoAl+JDHZltVsEkEjcz0MQJBAMmOAQPqwipaX7XhmYOyNqQ3ccsWv7c960KKl5bX+2qeDNxpsrHjvXWDXt6yK1U6FRvvKYEkDEa/LPFmGXOVQpB="
    }
}
```

## 2. <a href="#steptwo"></a>Create Node Configuration

From the ot-node directory (in WSL), run the below command

```bash
bash tools/windows-wsl-local-node-config/create-windows-node-configuration.sh
```

This will create 4 configuration files under the **windows-wsl-local-node-config** directory. One for the bootstrap DC node:

```
.bootstrap_origintrail_noderc
```
And for three DH nodes:
```
.dh1_origintrail_noderc
.dh2_origintrail_noderc
.dh3_origintrail_noderc
```
**Note:** It's not required to run the bootstrap node if you are already running a local DC node in development, and are using the DC network private key for config creation. See step 1.

### Specifying the number of nodes

If required, you can specify to create configuration for anywhere between one and ten nodes with the `--nodes` parameter.

```bash
bash tools/windows-wsl-local-node-config/create-windows-node-configuration.sh --nodes=10
```

The first node will be named `bootstrap`, while subsequent nodes will be named `dh1, dh2, ...`.

## 3. Running the nodes

Once the configuration has been created, open a new WSL terminal window for each node you want to start and from your ot-node directory, execute:

```
node index.js ./tools/windows-wsl-local-node-config/.dh1_origintrail_noderc
```

Replace `.dh1_origintrail_noderc` with the node config you want to start.

**Note:** Make sure that you are running your nodes with the `NODE_ENV=development` option set in the **.env** file.

Limitations with WSL 
============

If wanting to send API requests to nodes outside of WSL, i.e. Postman on the Windows host, the host IP needs to be whitelisted. 

As part of the config generation, the host IP is added to the `ipWhitelist` config section. **If your host IP changes on machine restart, you will need to regenerate the node configuration files again, by following [step 2](#steptwo).**

Contribution
============

OriginTrail is an open source project. We happily invite you to join us in our mission of building decentralized knowledge graph. If you would like to contribute, you are more than welcome.


### Useful links


[OriginTrail website](https://origintrail.io)

[OriginTrail documentation page](http://docs.origintrail.io)

[OriginTrail Discord Group](https://discordapp.com/invite/FCgYk2S)

[OriginTrail Telegram Group](https://t.me/origintrail)

[OriginTrail Twitter](https://twitter.com/origin_trail)

