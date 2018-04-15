### Version 3.0 (March 3, 2018)

Gordon Hall (gordonh@member.fsf.org)  

---

### 0    License

Copyright (C) 2018 Gordon Hall  

Permission is granted to copy, distribute and/or modify this document
under the terms of the GNU Free Documentation License, Version 1.3
or any later version published by the Free Software Foundation;
with no Invariant Sections, no Front-Cover Texts, and no Back-Cover Texts.
A copy of the license is included in the "LICENSE" file.

### 1    Introduction

This specification documents the Kadence protocol in its entirety for 
the purpose of enabling its implementation in other languages. Described here, 
is the protocol base - the minimum specification for compatibility with 
Kadence. Additional optional extensions to this work may be defined in a 
future specification.

### 2    Identities

Every node (host computer speaking the Kadence protocol) on the network 
possesses a unique cryptographic identity. This identity is used to derive a 
special 160 bit identifier for the purpose of organizaing the overlay structure 
and routing messages _(3.1: Kademlia)_. In order for a node to join the network 
it must generate an identity.

Identities are described as **hierarchically deterministic** and serve the 
purpose of running a cluster of nodes that can all share the same parent 
identity and act on behalf of each other in the network. The specification 
extends Bitcoin ECDSA derivation standard 
[BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) and 
[BIP43](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki).

Key derivation must match the specification of Bitcoin Hierarchical 
Deterministic Wallets (BIP32) with the purpose field described in Bitcoin 
Purpose Field for Deterministic Wallets (BIP43).

We define the following levels in BIP32 path:

```
m / purpose' / group_index' / node_index
```

The apostrophe in the path indicates that BIP32 hardened derivation is used. 
Purpose is a constant set to 3000, so as to not collide with any bitcoin 
related proposals which recommends to use the BIP number.

```
m / 3000' / group_index' / node_index
```

The `group_index` for all purposes will be 0. The `node_index` can be a number 
from 0 through 2 ^ 31 - 1, so that it's using a non-hardened paths and it's 
always possible to derive the public key for a node using the 
`m / 3000' / group_index'` derived extended public key. This gives a total of 
2.147 billion possible nodes to run in a group cluster.

> As noted in BIP32, a compromised private key at the `node_index` level in 
> combination with the extended public key at the `group_index` level will 
> compromise all descending private keys derived from the `group_index` level, 
> this is the rationale for a hardened path for the `group_index`.

In every message exchanged on the network, each party will include a tuple 
structure which includes enough information to locate and authenticate each 
party.

```
["<node_id>", { /* <contact> */ }]
```

#### 2.1    Node ID Generation

Once a HD identity has been generated, a child identity should be derived and 
used for a single node. The resulting public key from that child identity is 
used to derive the Node ID. The node's identifier is the 
`RIPEMD160( SHA256( CHILD_PUBLIC_KEY ) )` encoded in hexidecimal. This value 
is inserted as the first item in the identity tuple.

```
["705e93f855e60847fda4c48adff0dc1b1f7c40ef", { /* <contact> */ }]
```

> Note that the `xpub` and `index` properties of the contact object must yield 
> a public key that hashes to produce a valid difficulty if 
> {@link module:kadence/eclipse} is in use.

#### 2.2    Contact Hash Map

The second entry in the identity tuple contains additional information specific 
to addressing the node on the network. This includes:

```
{
  "hostname": "ip.address.or.domain.name",
  "port": 8443,
  "protocol": "https:",
  "xpub": "<child_identity_public_extended_key>",
  "index": "<child_identity_derivation_index>"
}
```

Additional properties may be included based on individual use cases within the 
network, however the properties above are **required**.

### 3    Network Structure

Kadence employs a **structured** network, meaning that nodes are organized and 
route messages based on a deterministic metric. The network uses a 
[Kademlia](http://www.scs.stanford.edu/~dm/home/papers/kpos.pdf) distributed 
hash table as the basis for the network overlay. In addition to Kademlia, 
Kadence also employs other extensions to mitigate issues and attacks defined 
by the work on [S/Kademlia](http://www.tm.uka.de/doc/SKademlia_2007.pdf). 

#### 3.1    Kademlia

Once a Kadence node has completed generating its identity, it bootstraps its 
routing table by following the Kademlia "join" procedure. This involves 
querying a single known "seed" node for contact information about other nodes 
that possess a Node ID that is close (XOR distance) to its own 
_(4.4 FIND_NODE)_. This is done iteratively, sending the same query to the 
`ALPHA` (3) results that are closest, until the further queries no longer 
yield results that are closer or the routing table is sufficiently 
bootstrapped.

#### 3.2    Transport

Kadence operates by default entirely over HTTPS. In general this means that 
certificates are self-signed and you must accept them in order to communicate 
with others on the network. 

Each Kadence node exposes an endpoint to other nodes  for receiving RPC 
messages _(4. Remote Procedure Calls). Requests sent to the RPC endpoint 
require a special HTTP header `x-kad-message-id` to be included that matches 
the `id` parameter in the associated RPC message 
_(4.1 Structure and Authentication)_.

### 4    Remote Procedure Calls

* **Method:** `POST`
* **Path:** `/`
* **Content Type:** `application/json`
* **Headers:** `x-kad-message-id`

#### 4.1    Structure and Authentication

Each remote procedure call sent and received between nodes is composed in the 
same structure. Messages are formatted as a 
[JSON-RPC 2.0](http://www.jsonrpc.org/specification) *batch* payload containing 
3 objects. These objects are positional, so ordering matters. The anatomy of a 
message takes the form of:

```
[{ /* rpc */ },{ /* notification */ },{ /* notification */ }]
```

At position 0 is the RPC request/response object, which must follow the 
JSON-RPC specification for such an object. It must contain the properties: 
`jsonrpc`, `id`, `method`, and `params` if it is a request. It must contain the 
properties: `jsonrpc`, `id`, and one of `result` or `error` if it is a 
response.

At positions 1 and 2 are a JSON-RPC notification object, meaning that it is not 
required to contain an `id` property since no response is required. These two 
notifications always assert methods `IDENTIFY` and `AUTHENTICATE` respectively.
Together, these objects provide the recipient with information regarding the 
identity and addressing information of the sender as well as a cryptographic 
signature to authenticate the payload.

At position 3, if the individual RPC method being invoked requires it, a 
hashcash proof-of-work stamp (see {@link module:kadence/hashcash}) must 
be included. This is to prevent spam and denial of service attacks from 
flooding segments of the network with queries.

> Positions 4 and beyond in this structure are reserved for future protocol 
> extensions related to global message processing.

##### Example: Request

```
[
  {
    "jsonrpc": "2.0",
    "id": "<uuid_version_4>",
    "method": "<method_name>",
    "params": ["<parameter_one>", "<parameter_two>"]
  },
  {
    "jsonrpc": "2.0",
    "method": "IDENTIFY",
    "params": [
      "<public_key_hash>", 
      {
        "hostname": "sender.hostname",
        "port": 8443,
        "protocol": "https:",
        "xpub": "<public_extended_key>",
        "index": "<child_key_derivation_index>"
      }
    ]
  },
  {
    "jsonrpc": "2.0",
    "method": "AUTHENTICATE",
    "params": [
      "<payload_signature>",
      "<child_public_key>",
      ["<public_extended_key>", "<child_key_derivation_index>"]
    ]
  },
  {
    "jsonrpc": "2.0",
    "method": "HASHCASH",
    "params": ["<hashcash_stamp>"]
  }
]
```

##### Example: Response

```
[
  {
    "jsonrpc": "2.0",
    "id": "<uuid_version_4_from_request>",
    "result": ["<result_one>", "<result_two>"]
  },
  {
    "jsonrpc": "2.0",
    "method": "IDENTIFY",
    "params": [
      "<public_key_hash>", 
      {
        "hostname": "receiver.hostname",
        "port": 8443,
        "protocol": "https:",
        "xpub": "<public_extended_key>",
        "index": "<child_key_derivation_index>"
      }
    ]
  },
  {
    "jsonrpc": "2.0",
    "method": "AUTHENTICATE",
    "params": [
      "<payload_signature>",
      "<child_public_key>",
      ["<public_extended_key>", "<child_key_derivation_index>"]
    ]
  }
]
```

In the examples above, `public_key_hash` and `child_public_key` must be encoded 
as hexidecimal strings, `public_extended_key` must be encoded as a base58 
string (in accordance with BIP32), and `payload_signature` must be encoded as a
base64 string which is the concatenation of the public key recovery number with 
the actual signature of the payload - excluding the object at index 2 
(`AUTHENTICATE`). This means that the message to be signed is 
`[rpc, identify]`.

The rest of this section describes each individual method in the base protocol 
and defines the parameter and result signatures that are expected. If any RPC 
message yields an error, then an `error` property including `code` and 
`message` should be send in place of the `result` property.

#### 4.2    `PING`

This RPC involves one node sending a `PING` message to another, which 
presumably replies. This has a two-fold effect: the recipient of the `PING` 
must update the bucket corresponding to the sender; and, if there is a reply, 
the sender must update the bucket appropriate to the recipient.

Parameters: `[]`  
Results: `[]`

#### 4.3    `FIND_NODE`

Basic kademlia lookup operation that builds a set of K contacts closest to the 
the given key. The `FIND_NODE` RPC includes a 160-bit key. The recipient of the 
RPC returns up to K contacts that it knows to be closest to the key. The 
recipient must return K contacts if at all possible. It may only return fewer 
than K if it is returning all of the contacts that it has knowledge of.

Parameters: `[key_160_hex]`  
Results: `[contact_0, contact_1, ...contactN]`

#### 4.4    `FIND_VALUE`

Kademlia search operation that is conducted as a node lookup and builds a list 
of K closest contacts. If at any time during the lookup the value is returned, 
the search is abandoned. If no value is found, the K closest contacts are 
returned. Upon success, we must store the value at the nearest node seen during 
the search that did not return the value.

A `FIND_VALUE` RPC includes a B=160-bit key. If a corresponding value is 
present on the recipient, the associated data is returned. Otherwise the RPC is 
equivalent to a `FIND_NODE` and a set of K contacts is returned.

If a value is returned, it must be in the form of an object with properties: 
`timestamp` as a UNIX timestamp in milliseconds, `publisher` as a 160 bit 
public key hash in hexidecimal of the original publisher, and `value` which may 
be of mixed type that is valid JSON.

Parameters: `[key_160_hex]`  
Results: `{ timestamp, publisher, value }` or `[...contactN]`

#### 4.5    `STORE`

The sender of the `STORE` RPC provides a key and a block of data and requires 
that the recipient store the data and make it available for later retrieval by 
that key.

Parameters: `[key_160_hex, { timestamp, publisher, value }]`  
Results: `[key_160_hex, { timestamp, publisher, value }]`

### 6    Kadence Controller API

The Kadence daemon exposes a local RPC server via UNIX domain socket and will 
accept JSON-RPC payloads as newline terminated strings. The use of domain 
sockets allows for improved security, leveraging POSIX file ownership and 
users to prevent unauthorized control of the daemon from other users or 
processes on the same system and prevents remote intrusion. The JSON-RPC 
message format is the same as described in _4: Remote Procedure Calls_.

See {@link Control} for more detailed information.

### 7    References

* BIP32 (`https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki`)
* BIP43 (`https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki`)
* Kademlia (`http://www.scs.stanford.edu/~dm/home/papers/kpos.pdf`)
* S/Kademlia (`http://www.tm.uka.de/doc/SKademlia_2007.pdf`)
