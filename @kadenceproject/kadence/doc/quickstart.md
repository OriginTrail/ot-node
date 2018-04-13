Getting started with building distributed systems with Kadence is simple, but 
requires a basic understanding of it's architecture in order to make the most 
effective use of what it has to offer. There are two ways to build on top of 
Kadence: using the complete reference implementation as a daemon and 
communicating with it from *any language* using the {@link Control} interface 
or using the core library directly using JavaScript. This tutorial will cover 
both approaches.

> Note that this guide assumes you already have Kadence installed. If you have 
> not installed Kadence, follow our guide for {@tutorial install} and come 
> back here when you're ready!

### Contents

1. [Using the Daemon](#daemon)
2. [Using the Library](#library)

<span id="daemon"></span>
### Using the Daemon

Kadence "proper" describes a Kademlia DHT with several notable protocol 
extensions - specifically the extensions that are authored in the core library 
as plugins:

* {@link module:kadence/spartacus}
* {@link module:kadence/eclipse}
* {@link module:kadence/hashcash}
* {@link module:kadence/permission}
* {@link module:kadence/quasar}

The daemon also leverages the following plugins that do not affect the protocol 
itself, but rather provide features that improve the user experience or enable 
other optional features.

* {@link module:kadence/rolodex}
* {@link module:kadence/traverse}
* {@link module:kadence/onion}
* {@link module:kadence/hibernate}

Together these plugins combined with the base implementation of the Kademlia 
DHT form the Kadence protocol and a complete standalone program for running a 
configurable Kadence node. If you installed Kadence using the `-g` or 
`--global` flag, you now have access to the `kadence` command line program. 
This program handles everything you need to interact with a Kadence network 
from any programming language.

#### Identity Generation

Kadence mitigates eclipse attacks (a form of a sybil attack) by requiring node 
identities to act as a proof-of-work solution. This means that Kadence expects 
your node identity to be derived from a public key of which the Scrypt hash 
contains a number of leading zero bits as defined by the value of
{@link module:kadence/constants~IDENTITY_DIFFICULTY}. This prevents adversaries 
from quickly generating a large number of identities that are close enough to 
each other to "surround" sections of the keyspace which could allow them to 
poison the routing table, deny service, or otherwise manipulate portions of the 
network.

The first time you run `kadence`, it will automatically begin "mining" a valid 
identity, which can take some time depending on your hardware. If you are just 
getting started with testing Kadence, you'll probably want to set 
`TestNetworkEnabled=1` in your `$HOME/.config/kadence/config` or set the 
environment variable `kadence_TestNetworkEnabled=1` (see {@tutorial config}). 
This will reduce the difficulty significantly and allow you to get started 
quickly. In a live "production" network, you can pass `--solvers N` where `N` 
is the number of CPU cores you'd like to dedicate to identity mining (and 
solution mining as discussed later).

In the example below, we are also setting `kadence_TraverseNatEnabled=0` 
because for now we aren't interested in punching out and becoming addessable 
on the internet.

```
$ export kadence_TestNetworkEnabled=1 kadence_TraverseNatEnabled=0

$ kadence
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"kadence is running in test mode, difficulties are reduced","time":"2018-03-16T15:28:05.188Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":40,"msg":"identity derivation not yet solved - 0 is invalid","time":"2018-03-16T15:28:05.357Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"solving identity derivation index with 1 solver processes, this can take a while","time":"2018-03-16T15:28:05.357Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"forking derivation process 0","time":"2018-03-16T15:28:05.377Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"solved identity derivation index 11 in 882ms","time":"2018-03-16T15:28:06.239Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"initializing kadence","time":"2018-03-16T15:28:06.244Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"validating solutions in wallet, this can take some time","time":"2018-03-16T15:28:06.257Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"node listening on local port 5274 and exposed at https://127.0.0.1:5274","time":"2018-03-16T15:28:06.262Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"binding controller to path /home/bookchin/.config/kadence/kadence.sock","time":"2018-03-16T15:28:06.262Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"forking solver process 0","time":"2018-03-16T15:28:06.263Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"no bootstrap seeds provided and no known profiles","time":"2018-03-16T15:28:06.269Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"running in seed mode (waiting for connections)","time":"2018-03-16T15:28:06.269Z","v":0}
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"derivation solver 0 exited normally","time":"2018-03-16T15:28:06.272Z","v":0}
```

Notice the log message `solved identity derivation index 11 in 882ms`. This 
means that a new hierarchically deterministic private extended key was 
generated and the child private key at index 11 yielded a public key that when 
hashed with Scrypt satisfies the identity difficulty. Now you can join your 
test Kadence network.

#### Solution Mining

Once your Kadence node has generated a valid identity, you'll begin seeing log 
messages similar to the following:

```
{"name":"kadence","hostname":"librem","pid":23409,"level":30,"msg":"solver 0 found solution in 4 attempts (226ms)","time":"2018-03-16T15:28:06.804Z","v":0}
```

This is part of Kadence's permission protocol for storing entries in the DHT. 
In a basic Kademlia network, entries can be stored and overwritten by any 
party. Kadence employs a proof-of-work system that requires nodes attempting 
to store an entry provide a "solution". Solutions are "mined" by a process 
similar to how Kadence identities are generated, but instead are derived from 
the identity solution. When a solution is found, it is stored in a "wallet" - 
a directory of solution files.

Solutions are then hashed and the resulting 160 bit key can be used to store 
arbitrary data in the DHT and is keyed by the solution hash. In practice, this 
means that your application must track any mapping from a key your application 
understands to the solution hash that was used to store the entry in the 
network.

> While `TestNetworkEnabled=1`, these solutions will be found very quickly, so 
> it's probably desirable to start the daemon with `--solvers 0` after you have 
> mined enough solutions to use during development.

#### Controlling the Daemon

The Kadence daemon exposes a control interface to other applications by default 
over a UNIX domain socket located at `$HOME/.config/kadence/kadence.sock`, but 
may also be configured to listen on a TCP port instead. You may not enable both 
types at once.

The control interface speaks JSON-RPC 2.0 and it's {@link Control API is 
documented here}. You can interact with the controller from any language that 
can open a socket connection. For this example we'll use `telnet` and use the 
TCP socket interface. 

```
$ export kadence_ControlPortEnabled=1 kadence_ControlSockEnabled=0

$ kadence --solvers 0
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"kadence is running in test mode, difficulties are reduced","time":"2018-03-16T16:43:04.440Z","v":0}
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"initializing kadence","time":"2018-03-16T16:43:04.503Z","v":0}
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"validating solutions in wallet, this can take some time","time":"2018-03-16T16:43:04.519Z","v":0}
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"node listening on local port 5274 and exposed at https://127.0.0.1:5274","time":"2018-03-16T16:43:04.576Z","v":0}
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"binding controller to port 5275","time":"2018-03-16T16:43:04.577Z","v":0}
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"there are no solver processes running","time":"2018-03-16T16:43:04.577Z","v":0}
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"no bootstrap seeds provided and no known profiles","time":"2018-03-16T16:43:04.578Z","v":0}
{"name":"kadence","hostname":"librem","pid":24893,"level":30,"msg":"running in seed mode (waiting for connections)","time":"2018-03-16T16:43:04.578Z","v":0}
```

When starting Kadence with `ControlPortEnabled=1`, you'll notice a log message 
`binding controller to port 5275`. Open a connection to this port and you can 
start sending commands by typing a JSON-RPC payload and pressing return (which
terminates the command with a `\r\n`). The result of the command will be 
written back to the socket.

```
$ telnet localhost 5275
Trying ::1...
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
{"jsonrpc":"2.0","id":"1234567890","method":"getProtocolInfo","params":[]}
{"jsonrpc":"2.0","id":"1234567890","result":[{"versions":{"protocol":"1.0.0","software":"3.1.2"},"identity":"27f06eba2be0a5f1399bfc0ebd477522118d1f69","contact":{"hostname":"127.0.0.1","protocol":"https:","port":5274,"xpub":"xpub69sEXvvUfWbQg8FSCPWPojcrUpkbtNkKDLSNSTx9GAsB1MVpeZ5eoCQTo4EViDnVn7pPpLbGq83aoD24vTGPnDKnXxqGJxxNbEJhizfFFQH","index":11,"agent":"1.0.0"},"peers":[]}]}
^]
telnet> quit
Connection closed.
```

Complete documentation on configuration properties and what they do can be 
reviewed in the {@tutorial config}.

<span id="library"></span>
### Using the Library

Not all use-cases require the exact properties of a "proper" Kadence network. 
Because of this, Kadence exposes it's core library as a complete framework for 
building distributed systems. This guide will demonstrate how to use the 
Kadence framework to invent new distributed protocols.

Start by following the guide for {@tutorial install} and install Kadence 
locally to a new project. First create your project.

```
$ mkdir myproject
$ cd myproject
$ npm init
```

Then install Kadence and save the dependency to your `package.json` file.

```
$ npm install @kadenceproject/kadence --save
```

#### Creating a Node

Most of the framework revolves around the instantiation of a 
{@link KademliaNode}, which exposes the primary interface for extending the 
protocol. There are several required options to provide, notably:

* {@link AbstractNode~transport}
* {@link AbstractNode~storage}
* {@link Bucket~contact}
* Identity buffer (160 bits)

For this example we'll be using the {@link UDPTransport} and a LevelDB database 
provided by the `levelup` and `leveldown` packages.

```js
const kadence = require('@kadenceproject/kadence');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encode = require('encoding-down');

const node = new kadence.KademliaNode({
  identity: kadence.utils.getRandomKeyBuffer(),
  transport: new kadence.UDPTransport(),
  storage: levelup(encode(leveldown('path/to/database'))),
  contact: {
    hostname: 'my.hostname',
    port: 8080
  }
});
```

The code above is the minimum setup for a complete Kademlia DHT. If this is all 
you require, then all you need to do is listen on the port specified in the 
`contact.port` option and join a known seed with {@link KademliaNode#join}. The 
provided seed must be defined as a tuple (array) where the first item is the 
hex encoded identity key of the seed and the second item is the 
{@link Bucket~contact} object. You can read more about this structure in our 
guide on {@tutorial identities}.

If this node is the "first node" in the network, you don't need to call 
{@link KademliaNode#join}, instead our node will just listen for connections 
from others.

```js
const seed = ['0000000000000000000000000000000000000000', { // (sample)
  hostname: 'seed.hostname',
  port: 8080
}];

node.once('join', function() {
  console.info(`connected to ${node.router.size} peers`);
});

node.once('error', function(err) {
  console.error('failed to join the network', err);
});

node.listen(node.contact.port);
node.join(seed);
```

That's it, for a basic minimal Kademlia DHT, you're finished! Now you can use 
the methods on {@link KademliaNode} to store and retrieve entries from the 
network. To learn more about using plugins, extending the protocol with 
middleware, custom transports, and the message pipelines, see:

* {@tutorial plugins}
* {@tutorial middleware}
* {@tutorial transport-adapters}
* {@tutorial messengers}
* [Examples on GitHub](https://github.com/kadence/kadence/tree/master/example)
