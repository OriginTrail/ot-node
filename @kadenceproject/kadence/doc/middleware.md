Kadence exposes an interface similar to [express](https://expressjs.com)'s 
`use()` method to allow for extending the protocol via message processing 
middleware. There are 4 distinct middleware stacks that process incoming 
messages in a particular order:

### Global Message Stack

Global middleware is applied to any and all deserialized messages that are 
provided to {@link AbstractNode} from the {@link Messenger~deserializer}. 
Handlers added here are useful for any global logic that needs to be applied 
such as validation of message format.

Global middleware handlers follow the signature defined by 
{@link AbstractNode~middleware} and are supplied as the only argument to 
{@link AbstractNode#use}. The middleware handler receives, in order, 
{@link AbstractNode~request}, {@link AbstractNode~response}, and 
{@link AbstractNode~next} (which may be called with an error to exit the stack
and trigger the error handler stack).

A simple example of a global middleware handler is a node blacklist. In the 
example below, we define a set of node identities from which we wish to reject 
all messages.

```js
const blacklist = new Set([/* misbehaving node ids */]);

node.use(function(request, response, next) {
  let [identity] = request.contact;

  if (blacklist.includes(identity)) {
    return next(new Error('Go away!')); // Exit this stack and enter error stack
  }

  next(); // Continue to next handler in stack
});
```

### Filtered Message Stack

The primary function of the middleware stack is to enable developers to invent 
new protocols by defining handlers for new methods. Similar to the Express 
framework, if we wish to only apply a handler to certain types of messages, we 
can define the method name as the first argument supplied to 
{@link AbstractNode#use} and our handler as the second. 

This enables us to extend the base Kademlia protocol with new methods and 
behaviors. If a message is received that invokes a method for which there is 
not a handler defined, after being processed by the global stack, it will enter 
the error handler stack with a "Method not found" error object.

To demonstrate how this works, we provide an example of an `ECHO` handler - a 
new protocol method that simply echoes the argument provided back to the 
sender.

```js
node.use('ECHO', function(request, response, next) {
  let [message] = request.params;

  if (!message) {
    return next(new Error('Nothing to echo')); // Exit to the error stack
  }

  response.send([message]); // Respond back with the argument provided
});
```

Like the global message stack, the filtered message stack can also have many 
handlers defined. This is useful in the event that you want to provide 
per-message-type validation without placing all of that logic into a single 
handler. The same rules apply, call {@link AbstractNode~next} to move to the 
next handler in the stack and call {@link AbstractNode~response#send} to halt 
the stack and respond to the message.

### Error Handler Stack

Error handling middleware is applied to any message which previously resulting 
in a call to {@link AbstractNode~next} with an error parameter. They are 
defined by including an error argument in the first position to a
{@link AbstractNode~middleware} function. These can be scoped globally or by 
protocol and will behave just like the global message stack and filtered 
message stack. When a message enters the error handler stack, first it will 
pass through the global error handlers then the filtered error handlers. If 
there are no error handler middleware functions defined, the default handler, 
which simply responds with the error message, is used.

```js
node.use(function(err, request, response, next) {
  if (!err) {
    response.error('Method not found', -32602);
  } else {
    response.error(err.message, err.code);
  }
});

node.use('ECHO', function(err, request, response, next) {
  response.error(`ECHO error: ${err.message}`);
});
```

Remember, the number of arguments supplied to {@link AbstractNode~middleware} 
**matters**. Error handlers are registered if and only if there are 4 arguments 
provided to {@link AbstractNode~middleware}: `error`, 
{@link AbstractNode~request}, {@link AbstractNode~response}, and 
{@link AbstractNode~next} *in order*. If there are less than four arguments 
provided to the handler, it will not be inserted into the error handler stack.
