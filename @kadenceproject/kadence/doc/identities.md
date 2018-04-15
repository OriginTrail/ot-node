Kadence represents other peers by using a {@link Bucket~contact} pair. Any 
time an entry in a {@link Bucket} is retrieved or placed, it is in the format 
of a tuple. The item at index 0 is *always* the string representation of the 
{@link module:kadence/constants~B} size identity key in hexadecimal. The item 
at index 1 can be any arbitrary JSON serializable object that the 
{@link transport-adapters transport adapter} in use understands.

For example, the {@link HTTPTransport} and the {@link UDPTransport} both accept 
an object cotaining `hostname` and `port` properties. Other transports may 
accept whatever they need. When constructing your {@link KademliaNode} 
instance, these properties are set by you as `identity` and `contact`. If the 
`identity` value is omitted, it will be randomly generated.

> Take note that for a stable network, you will need to persist identities 
> generated as nodes store data based on this key.

```js
const node = new kadence.KademliaNode({
  // ...
  identity: Buffer.from('059e5ce8d0d3ee0225ffe982e38f3f5f6f748328', 'hex'),
  contact: {
    hostname: 'my.reachable.hostname',
    port: 1337
  }
});
```

Since nodes may be using {@link module:kadence/traverse} to become addressable 
on the internet, this {@link Bucket~contact} pair is included in every message 
payload instead of relying on inferred return address information at the 
transport layer. This makes every JSON-RPC message payload an array, containing 
a request message at index 0 and a idenity notification at index 1.

```json
[
  {
    "jsonrpc": "2.0",
    "id": "<uuid>",
    "method": "FIND_NODE",
    "params": ["059e5ce8d0d3ee0225ffe982e38f3f5f6f748328"]
  },
  {
    "jsonrpc": "2.0",
    "method": "IDENTITY",
    "params": [
      "059e5ce8d0d3ee0225ffe982e38f3f5f6f748328",
      {
        "hostname": "<reachable hostname>",
        "port": 1337
      }
    ]
  }
]
```
