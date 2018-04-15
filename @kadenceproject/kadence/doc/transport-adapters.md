Kadence does not impose any particular transport layer, which makes it very 
flexible for applying to many use cases. As far as Kadence is concerned, a valid 
transport adapter is any `objectMode` 
[`DuplexStream`](https://nodejs.org/dist/latest-v6.x/docs/api/stream.html) 
that exposes a `listen()` method.

Kadence ships with UDP and HTTP(S) transports so you don't need to implement a 
transport adapter yourself to get started. If your network layer needs are not 
met by these, check out the interface for {@link AbstractNode~transport}.

### API for Transport Implementers

The transport adapter interface has been designed to make implementing any 
given networking or communication layer easy using JavaScript's inheritance 
model.

First, a developer would declare a new JavaScript class that extends the 
[`DuplexStream`](https://nodejs.org/dist/latest-v6.x/docs/api/stream.html) 
class, and implements the `_read`, `_write`, and `listen` methods. This 
architecture makes it simple to implement any type of transport layer.

When a consumer *reads* from the stream, they shall expect to receive a raw 
buffer representing a received message which is processed by a 
{@link Messenger} instance. When a consumer *writes* to the stream, they shall 
expect the adapter to dispatch the message to the target. Calling `listen` on 
the stream should perform any initialization needed, like binding to a port.

Transport streams must be placed in `objectMode`. The `_read` method must push 
the received messages as raw buffers to be parsed by the deserializer used by 
the {@link Messenger} class (which by default is JSON-RPC). The `_write` method 
receives an array object as it's first argument which contains the following:

```js
[
  // String: unique identifier for the message, can be a request or a response
  messageId,
  // Buffer: raw payload to be delivered to the target
  messagePayload,
  [
    // String: target contact's identity key
    identityKey,
    // Object: target contact's address information (transport-specific)
    contactInfo
  ]
]
```

### Example: UDP Transport

Implementing a UDP based transport adapter is very simple given that no state
must be maintained between requests and responses, so we will use it as a 
simple example of how you might implement a transport.

```js
const { Duplex: DuplexStream } = require('stream');
const dgram = require('dgram');

class UDPTransport extends DuplexStream {

  constructor(options) {
    super({ objectMode: true });
    this.socket = dgram.createSocket();
  }

  _write([id, buffer, target], encoding, callback) {
    let [, contact] = target;
    this.socket.send(buffer, 0, buffer.length, contact.port, contact.hostname,
                     callback);
  }

  _read() {
    this.socket.once('message', (buffer) => {
      this.push(buffer);
    });
  }

  listen() {
    this.socket.bind(...arguments);
  }

}
```
