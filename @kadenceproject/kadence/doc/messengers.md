Kadence implements a generic {@link Messenger} class that is used as the interface 
between the application layer and the {@link AbstractNode~transport}. This 
interface exposes 2 primary members: {@link Messenger~serializer} and 
{@link Messenger~deserializer}.

As you might expect, both of these objects are streams. Both are transform 
streams. The transport adapter's readable end is piped through the 
deserializer which is then processed by the middleware stack implemented by 
the {@link AbstractNode}. The serializer is piped through the transport 
adapter's writable end, which dispatches the message.

The serializer and deserializer are 
[metapipe](https://github.com/bookchin/metapipe) objects (transform streams 
which are composed of a modifiable stack of transform streams). This means you 
can extend the behavior of messages processing by simply prepending or 
appending your own transforms.

> By default, these metapipes use a built-in JSON-RPC serializer and 
> deserializer. It is possible to completely change the message format sent 
> over the network if desired by passing {@link KademliaNode} your own instance 
> of {@link Messenger} using your own serializer and deserializer.

Below is an example of extended the message processing pipeline.

```
const { Transform } = require('stream');
const node = new kadence.KademliaNode(options);

node.rpc.serializer.prepend(new Transform({
  transform function(data, encoding, callback) {

  },
  objectMode: true
}));

node.rpc.deserializer.append(new Transform({
  transform: function(data, encoding, callback) {

  },
  objectMode: true
}));
```

> Note that the {@link KademliaRules} still expect the deserialized message to 
> include `method` and `params` properties (conforming to 
> {@link AbstractNode~request}).

