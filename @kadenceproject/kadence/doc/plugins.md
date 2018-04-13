Kadence plugins are a simple way to package additional features. A plugin is just 
a function that receives an instance of {@link KademliaNode}. This function can 
then apply any decorations desired.

### Included Plugins

* {@link module:kadence/eclipse~EclipsePlugin}
* {@link module:kadence/hashcash~HashCashPlugin}
* {@link module:kadence/hibernate~HibernatePlugin}
* {@link module:kadence/onion~OnionPlugin}
* {@link module:kadence/permission~PermissionPlugin}
* {@link module:kadence/quasar~QuasarPlugin}
* {@link module:kadence/rolodex~RolodexPlugin}
* {@link module:kadence/spartacus~SpartacusPlugin}
* {@link module:kadence/traverse~TraversePlugin}

### Example: "Howdy, Neighbor" Plugin

```js
/**
 * Example "howdy, neighbor" plugin
 * @function
 * @param {KademliaNode} node
 */
module.exports = function(node) {

  const { identity } = node;

  /**
   * Respond to HOWDY messages
   */
  node.use('HOWDY', (req, res) => {
    res.send(['howdy, neighbor']);
  });

  /**
   * Say howdy to our nearest neighbor
   */
  node.sayHowdy = function(callback) {
    let neighbor = [
      ...node.router.getClosestContactsToKey(identity).entries()
    ].shift();
    
    node.send('HOWDY', ['howdy, neighbor'], neighbor, callback);
  };

};
```


