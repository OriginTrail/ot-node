// External modules
var call_process = require('child_process').exec
var blockchain = require('./blockchain')()
var utilities = require('./utilities')()
var product = require('./product')()
var config = utilities.getConfig()
async = require('async')

module.exports = function () {
  var importer = {

    importXML: function (ot_xml_document, selected_importer, callback) {
      var process = call_process('python3 importers/' + selected_importer + '.py ' + ot_xml_document, function (error, stdout, stderr) {
        if (stderr) {
          console.log(stderr)
          utilities.executeCallback(callback, {
            message: 'Import failure',
            data: []
          })
        } else {
          result = JSON.parse(stdout)
          batch_uids_array = Object.keys(result.batches)

          async.each(batch_uids_array, function (batch_uid, next) {
            product.getTrailByUID(batch_uid, function (trailObject) {
              var trail = trailObject.graph
              var bid = batch_uid
              var bid_hash = utilities.sha3(bid)
              var trail_hash = product.hashTrail(trail, bid)

              //          blockchain.addFingerprint(bid, bid_hash, trail_hash);

              next()
            })
          }, function () {
            utilities.executeCallback(callback, {
              message: 'Import success',
              data: []
            })
          })
        }
      })
    }

  }

  return importer
}
