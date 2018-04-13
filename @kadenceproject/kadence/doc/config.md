This guide will show you how to get started with running `kadence`! A Kadence 
node requires a configuration file to get up and running. The path to this 
file is given to `kadence` when starting a node (or the defaults will be used).

```
kadence --config myconfig.ini
```

If a configuration file is not supplied, a minimal default configuration is 
automatically created and used, which will generate a private extended key, 
self-signed certificate, database, and other necessary files. All of this data 
will be created and stored in `$HOME/.config/kadence`, unless a `--datadir` 
option is supplied. Valid configuration files may be in either INI or JSON 
format.

#### DaemonPidFilePath

##### Default: `$HOME/.config/kadence/kadence.pid`

The location to write the PID file for the daemon.

#### PrivateExtendedKeyPath

##### Default: `$HOME/.config/kadence/kadence.prv`

Path to private extended key file to use for master identity.

#### ChildDerivationIndex

##### Default: `0`

The index for deriving this node's identity in accordance with the identity 
difficulty. 

#### EmbeddedDatabaseDirectory

##### Default: `$HOME/.config/kadence/kadence.dht`

Sets the directory to store DHT entries.

#### EmbeddedPeerCachePath

##### Default: `$HOME/.config/kadence/peercache`

File to store discovered peers for bootstrapping on subsequent restarts.

#### EmbeddedWalletDirectory

##### Default: `$HOME/.config/kadence/wallet.dat`

Sets the directory to store solution files for storing entries in the DHT.

#### NodePublicPort

##### Default: `5274`

Sets the port number to advertise to the network for reaching this node.

#### NodeListenPort

##### Default: `5274`

Sets the local port to bind the node's RPC service.

#### NodePublicAddress

##### Default: `127.0.0.1`

Sets the public address to advertise to the network for reaching this node. 
If traversal strategies are enabled and succeed, this will be changed 
automatically. If onion mode is enabled, then this should be left at it's 
default.

#### NodeListenAddress

##### Default: `0.0.0.0`

Sets the address to bind the RPC service.

#### BandwidthAccountingEnabled

##### Default: `0`

Enables bandwidth metering and hibernation mode. When the property 
BandwidthAccountingEnabled is `1`, we will enter low-bandwidth mode if the we
exceed `BandwidthAccountingMax` within the period defined by 
`BandwidthAccountingReset` until the interval is finished.

#### BandwidthAccountingMax

##### Default: `5GB`

Sets the maximum number of bandwidth to use per accounting interval for data 
transfer. Low-bandwidth RPC messages will still be allowed.

#### BandwidthAccountingReset

##### Default: `24HR`

Resets the bandwidth accounting on an interval defined by this property.

#### VerboseLoggingEnabled

##### Default: `1`

More detailed logging of messages sent and received. Useful for debugging.

#### LogFilePath

##### Default: `$HEAD/.config/kadence.log`

Path to write the daemon's log file. Log file will rotate either every 24 hours 
or when it exceeds 10MB, whichever happens first.

#### LogFileMaxBackCopies

##### Default: `3`

Maximum number of rotated log files to keep.

#### NetworkBootstrapNodes[]

##### Default: `(empty)`

Add a map of network bootstrap nodes to this section to use for discovering 
other peers. Default configuration should come with a list of known and 
trusted contacts.

#### OnionEnabled

##### Default: `0`

Places Kadence into anonymous mode, which establishes the node exclusively as 
a Tor hidden services and forces all requests through the Tor network.

#### OnionVirtualPort

##### Default: `443`

The virtual port to use for the hidden service.

#### OnionHiddenServiceDirectory

##### Default: `$HOME/.config/kadence/hidden_service`

The directory to store hidden service keys and other information required by 
the Tor process.

#### OnionLoggingEnabled

##### Default: `0`

Redirects the Tor process log output through Kadence's logger for the purpose of 
debugging.

#### OnionLoggingVerbosity

##### Default: `notice`

Defines the verbosity level of the Tor process logging. Valid options are: 
`debug`, `info`, `notice`.

#### TraverseNatEnabled

##### Default: `1`

Enables UPnP and NAT-PMP traversal strategies for becoming addressable on the 
public internet.

#### TraversePortForwardTTL

##### Default: `0`

How long to keep the port mapping active on the router. The value `0` means 
indefinitely (until revoked).

#### SSLCertificatePath

##### Default: `$HOME/.config/kadence/kadence.crt`

Path to the SSL certificate for our node.

#### SSLKeyPath

##### Default: `$HOME/.config/kadence/kadence.key`

Path to the SSL private key for our node.

#### SSLAuthorityPaths[]

##### Default: `(emtpy)`

Paths to intermediate certificate authority chains.

#### ControlPortEnabled

##### Default: `0`

Enables the {@link Control} interface over a TCP socket.

#### ControlPort

##### Default: `5275`

The TCP port to for the control interface to listen on.

#### ControlSockEnabled

##### Default: `1`

Enables the {@link Control} interface over a UNIX domain socket.

#### ControlSock

##### Default: `$HOME/.config/kadence/kadence.sock`

The path to the file to use for the control interface.

#### TestNetworkEnabled

##### Default: `0`

Places Kadence into test mode, significantly lowering the identity solution
difficulty and the permission solution difficulty.
