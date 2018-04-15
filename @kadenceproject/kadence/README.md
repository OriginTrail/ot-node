<p align="center" class="docstrap-hideme">
  <a href="https://kadence.github.io"><img src="https://avatars1.githubusercontent.com/u/36767738?s=256"></a>
</p>
<p style="font-size:18px" align="center"><strong>Extensible, Hardened, and Secure Distributed Systems Framework</strong></p>
<p align="center">
  Join the discussion in <code>#kadence</code> on our <a href="https://matrix.counterpointhackers.org/_matrix/client/#/room/#kadence:matrix.counterpointhackers.org">Matrix server</a>!
</p>
<div align="center">
  <a href="https://travis-ci.org/kadence/kadence">
    <img src="https://img.shields.io/travis/kadence/kadence.svg?style=flat-square" alt="Build Status">
  </a> | 
  <a href="https://coveralls.io/r/kadence/kadence">
    <img src="https://img.shields.io/coveralls/kadence/kadence.svg?style=flat-square" alt="Test Coverage">
  </a> | 
  <a href="https://www.npmjs.com/package/@kadenceproject/kadence">
    <img src="https://img.shields.io/npm/v/@kadenceproject/kadence.svg?style=flat-square" alt="NPM Package">
  </a> | 
  <a href="https://hub.docker.com/r/kadence/kadence">
    <img src="https://img.shields.io/docker/pulls/kadence/kadence.svg?style=flat-square" alt="Docker Hub">
  </a> | 
  <a href="https://raw.githubusercontent.com/kadence/kadence/master/LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat-square" alt="AGPL-3.0 License">
  </a> | 
  <a href="https://github.com/kadence/kadence">
    <img src="https://img.shields.io/github/last-commit/kadence/kadence.svg?style=flat-square" alt="Source Code">
  </a>
</div>

---

Kadence
=======

The Kadence Project is a complete implementation of the 
[Kademlia](http://www.scs.stanford.edu/%7Edm/home/papers/kpos.pdf) distributed 
hash table that aims to effectively mitigate *all vulnerabilities* described in 
the [S/Kademlia](https://gnunet.org/sites/default/files/SKademlia2007.pdf) 
paper and then some! Kadence provides developers of distributed systems a 
complete framework for inventing new protocols on a rock solid base as well as 
providing a complete reference implementation of a Kadence network.

Ready to get started?

```
$ npm install -g @kadenceproject/kadence
$ kadence --help
```

If you're new to Kadence, check out our tutorial for {@tutorial quickstart}!

Features
--------

### Publish & Subscribe

Kadence implements a completely decentralized publish/subscribe protocol based 
on [Quasar](http://research.microsoft.com/en-us/um/people/saikat/pub/iptps08-quasar.pdf), 
allowing you to build anything from peer-to-peer social networks to real time 
sensor networks for the internet of things.

### DDoS & Spam Protection

Kadence enforces a [proof of work system](https://en.wikipedia.org/wiki/Proof-of-work_system) 
called [Hashcash](https://en.wikipedia.org/wiki/Hash_cash) for relaying 
messages to prevent abuse and make large scale denial of service and spam 
attacks cost prohibitive.

### Bandwidth Metering

Kadence monitors bandwidth and enables end users to configure their maximum 
bandwidth usage within a timeframe to suit their individual needs or prevent 
overages with internet services providers that enforce 
[bandwidth caps](https://en.wikipedia.org/wiki/Bandwidth_cap).

### End-to-End Encryption

Kadence can automatically generate SSL certificates and supports full 
end-to-end encryption via TLS using it's built in HTTPS transport adapter to 
prevent eavesdropping and [man in the middle attacks](https://en.wikipedia.org/wiki/Man-in-the-middle_attack).

### Cryptographic Identities

Kadence extends Kademlia's node identity selection with the same cryptography 
bitcoin uses for securing funds. Node identities are derived from the hash of 
the public portion of an [ECDSA](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm) 
key pair and each message is signed to ensure it hasn't been tampered with in 
transit.

### Sybil & Eclipse Mitigation

Kadence employs a [proof of work system](https://en.wikipedia.org/wiki/Proof-of-work_system) 
using [Scrypt](https://en.wikipedia.org/wiki/Scrypt) for generating valid
node identities and subsequent acceptance into the overlay network. This 
forces nodes into sufficiently random sectors of the key space and makes 
[Sybil](https://en.wikipedia.org/wiki/Sybil_attack) and 
[Eclipse](http://www.eecs.harvard.edu/~mema/courses/cs264/papers/eclipse-infocom06.pdf) 
attacks computationally very difficult and ultimately ineffective.

### Automatic NAT Traversal

Kadence supports multiple strategies for punching through 
[network address translation](https://en.wikipedia.org/wiki/Network_address_translation). 
This enables peers behind even the strictest of firewalls to become addressable 
and join the network.

### Multiple Network Transports

Kadence supports the use of multiple transport adapters and is agnostic to the 
underlying network protocol. Support for UDP and HTTP/HTTPS ship by default. 
Plugin your own custom transport layer using using a simple interface.

### Persistent Routing Tables

Kadence remembers peers between restarts so after you've joined the network once 
subsequent joins are fast and automatically select the best initial peers for 
bootstrapping.

### Permissioned Entries

Kadence grants write access to storage entries by verifying that the entry is 
paired with a unique [proof-of-work](https://en.wikipedia.org/wiki/Proof_of_work) 
solution using [Scrypt](https://en.wikipedia.org/wiki/Scrypt) that is derived 
from a valid node identity and signature. Solutions are found through a "mining" 
process and stored in a digital wallet for your use.

### Sender & Destination Anonymity

Kadence ships with full support for 
[Tor Hidden Services](https://en.wikipedia.org/wiki/Tor_hidden_service) out of 
the box with no additional software installation or configuration required. 
This enables fully anonymized structured networks and leverages the latest 
version 3 hidden services protocol.

### Simple Plugin Interface

Kadence exposes a simple interface for extending the protocol with your own 
application logic. Users of [Express](https://expressjs.com/) will find it 
comfortable and familiar. If you are new to building distributed systems, you 
will find it easy to get started.

Research
--------

Kadence is used in academic research on distributed systems. Here are some 
notable papers!

* [Secure and Trustable Distributed Aggregation based on Kademlia](https://arxiv.org/pdf/1709.03265.pdf)
* [Distributed Random Process for a large-scale Peer-to-Peer Lottery](https://hal.inria.fr/hal-01583824/document)
* [DHT-based collaborative Web Translation](https://etd.ohiolink.edu/!etd.send_file?accession=ucin1479821556144121&disposition=inline)
* [Kademlia with Consistency Checks as a Foundation of Borderless Collaboration in Open Science Services](https://www.sciencedirect.com/science/article/pii/S1877050916327041)

License
-------

    Kadence - Extensible, Hardened, and Secure Distributed Systems Framework  
    Copyright (C) 2014 - 2018 Gordon Hall

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.


