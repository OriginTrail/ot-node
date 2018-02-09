// External modules
var utilities = require('./utilities')()
var database = require('./database')()
var graph = require('./graph')()
var Database = require('arangojs').Database

var fs = require('fs')

module.exports = function () {
  // Private function
  function getProductJourney (virtual_graph_data, traversal) {
    var journey = []
    var batches = []
    var usedBatchUIDs = []
    var batchUIDs = []
    var events = []
    var usedEventIDs = []

    for (var i = 0; i < traversal.length; i++) {
      var point = traversal[i]
      if (point.vertex_type == 'PRODUCT_BATCH' && usedBatchUIDs[point.uid] != true) {
        var edges = point.outbound

        for (j in edges) {
          if (edges[j].edge_type == 'INSTANCE_OF') {
            point.product_info = virtual_graph_data[edges[j].to]
          } else if (edges[j].edge_type == 'RESULTED_BATCH' || edges[j].edge_type == 'OF_BATCH') {
            var event = virtual_graph_data[edges[j].to]
            event_edges = event.outbound

            for (i in event_edges) {
              if (event_edges[i].edge_type == 'AT') {
                point.location = virtual_graph_data[event_edges[i].to]
              }
            }
          }
        }

        usedBatchUIDs[point.uid] = true
        batches.push(point)
      }

      if (point.vertex_type == 'EVENT' && usedEventIDs[point.id.event_id] != true) {
        var edges = point.outbound

        usedEventIDs[point.id.event_id] = true
        events.push(point)
      }
    }

    var i = 1
    var j = 0

    if (batches.length > 0) {
      journey.push(batches[0])
    }

    while (i < batches.length && j < events.length) {
      journey.push(events[j++])
      journey.push(batches[i++])
    }

    if (i < batches.length) {
      journey.push(batches[i])
    }

    return journey
  }

  // Private function
  function getEvents (virtual_graph_data, traversal) {
    var events = []

    for (var i in traversal) {
      if (traversal[i].vertex_type == 'EVENT') {
        var raw_event = traversal[i]

        var edges = raw_event.outbound
        var location

        if (raw_event.EventType == 'TransformationEvent') {
          var new_event = {}

          var event_id = raw_event.id.event_id

          var event_date = raw_event.EventDate
          new_event.event_date = raw_event.EventDate

          var event_type = 'Transformation Event'

          var type = 'single'

          var direction = ''

          // YIMISHIJI specific
          if (raw_event.Provider == 'CN_YIMISHIJI_2017') {
            direction = 'right'
          } else {
            direction = 'left'
          }

          if (events[event_id] != undefined) {
            type = 'double'
          }

          new_event.business_process = raw_event.BusinessProcess
          new_event.total_quantity = raw_event.data.quantity

          if (typeof new_event.total_quantity === 'object') {
            new_event.total_quantity = new_event.total_quantity.quantity
          }

          new_event.product = []
          new_event.product.push(raw_event.InputProduct)
          new_event.product.push(raw_event.OutputProduct)

          new_event.data_provider = raw_event.Provider

          new_event.data_provider_business_location = {}
          new_event.data_provider_business_location.id = raw_event.BusinessLocation

          for (var j in edges) {
            if (edges[j].edge_type == 'AT') {
              location = virtual_graph_data[edges[j].to]
              new_event.data_provider_business_location.lat = location.data.latitude
              new_event.data_provider_business_location.lon = location.data.longitude
              new_event.data_provider_business_location.facility_name = location.data.facility_name.cn
              new_event.data_provider_business_location.type = location.data.type
            }
          }

          if (events[event_id] == undefined) {
            events[event_id] = {
              event_date: event_date,
              event_id: event_id,
              event_type: event_type,
              type: type
            }
          } else {
            events[event_id].type = type
          }

          events[event_id][direction] = new_event
        } else {
          var new_event = {}

          var event_id = raw_event.id.event_id

          var event_date = raw_event.EventDate
          new_event.event_date = raw_event.EventDate

          var event_type = 'Transfer Event'

          var type = 'single'

          var direction = ''

          // YIMISHIJI specific
          if (raw_event.Provider == 'CN_YIMISHIJI_2017') {
            direction = 'right'
          } else {
            direction = 'left'
          }

          if (events[event_id] != undefined) {
            type = 'double'
          }

          new_event.business_process = raw_event.BusinessProcess
          new_event.total_quantity = raw_event.data.quantity

          if (typeof new_event.total_quantity === 'object') {
            new_event.total_quantity = new_event.total_quantity.quantity
          }

          new_event.product = []
          new_event.product.push(raw_event.TransferedProduct)

          new_event.data_provider_business_location = {}
          new_event.data_provider_business_location.id = raw_event.BusinessLocation

          new_event.source_business_location = {}
          new_event.destination_business_location = {}

          var location = {}

          for (var j in edges) {
            if (edges[j].edge_type == 'AT') {
              location = virtual_graph_data[edges[j].to]
              new_event.data_provider_business_location.lat = location.data.latitude
              new_event.data_provider_business_location.lon = location.data.longitude
              new_event.data_provider_business_location.facility_name = location.data.facility_name.cn
              new_event.data_provider_business_location.type = location.data.type
            } else if (edges[j].edge_type == 'FROM') {
              location = virtual_graph_data[edges[j].to]
              new_event.source_business_location.id = location.id
              new_event.source_business_location.facility_name = location.data.facility_name.cn
              new_event.source_business_location.address = location.data.address
              new_event.source_business_location.lat = location.data.latitude
              new_event.source_business_location.lon = location.data.longitude
              new_event.source_business_location.city = location.data.city
              new_event.source_business_location.country = location.data.country_code
              new_event.source_business_location.type = location.data.type
            } else if (edges[j].edge_type == 'TO') {
              location = virtual_graph_data[edges[j].to]
              new_event.destination_business_location.id = location.id
              new_event.destination_business_location.facility_name = location.data.facility_name.cn
              new_event.destination_business_location.address = location.data.address
              new_event.destination_business_location.lat = location.data.latitude
              new_event.destination_business_location.lon = location.data.longitude
              new_event.destination_business_location.city = location.data.city
              new_event.destination_business_location.country = location.data.country_code
              new_event.destination_business_location.type = location.data.type
            }
          }

          if (events[event_id] == undefined) {
            events[event_id] = {
              event_date: event_date,
              event_id: event_id,
              event_type: event_type,
              type: type // single ili double
            }
          } else {
            events[event_id].type = type
          }

          events[event_id][direction] = new_event
        }
      }
    }

    var events_return_form = []

    for (var i in events) {
      events_return_form.push(events[i])
    }

    return events_return_form
  }

  var product = {

    // Get trail by custom query
    // =========================
    getTrail: function (queryObject, callback) {
      var restricted = false

      if (queryObject.restricted != undefined) {
        restricted = queryObject.restricted
        delete queryObject.restricted
      }

      graph.getVertices(queryObject, function (vertices) {
        if (vertices.length == 0) {
          utilities.executeCallback(callback, [])
          return
        }

        var start_vertex = vertices[0]

        graph.getTraversal(start_vertex, function (raw_graph_data) {
          var virtual_graph_data = graph.convertToVirtualGraph(utilities.copyObject(raw_graph_data))

          var returnBFS = utilities.copyObject(virtual_graph_data)
          var BFSt = graph.BFS(utilities.copyObject(returnBFS.data), start_vertex.uid, true)

          for (var i in BFSt) {
            if (BFSt[i].outbound != undefined) {
              delete BFSt[i].outbound
            }
          }

          // Sorting keys in object for uniform response
          for (var i in BFSt) {
            BFSt[i] = utilities.sortObject(BFSt[i])
          }

          var BFS = graph.BFS(utilities.copyObject(virtual_graph_data.data), start_vertex.uid, restricted)
          var BFS_data = utilities.copyObject(graph.BFS(virtual_graph_data.data, start_vertex.uid, restricted))

          var fetchedJourney = getProductJourney(utilities.copyObject(virtual_graph_data.data), utilities.copyObject(BFS))
          var fetchedEvents = getEvents(utilities.copyObject(virtual_graph_data.data), utilities.copyObject(BFS))

          var responseObject = {
            graph: virtual_graph_data.data,
            traversal: BFSt,
            journey: fetchedJourney,
            events: fetchedEvents,
            sha3: utilities.sha3(JSON.stringify(BFSt))
          }

          utilities.executeCallback(callback, responseObject)
        })
      })
    },
    // =========================

    getExpirationDates: function (queryObject, callback) {
      var queryString = `FOR v IN ot_vertices
					 FILTER v.data.tag == 'retail'`

      var params = {}

      var i = 1
      for (key in queryObject) {
        if (key.match(/^[\w\d]+$/g) == null) {
          continue
        }

        var param = 'param' + i
        filters.push('v.' + key + ' == @param' + i)
        i++

        params[param] = queryObject[key]
      }

      // YIMISHIJI specific
      queryString += ` AND v.id.expirationDate >= '2018-02-01' RETURN v.id.expirationDate`

      database.runQuery(queryString, function (result) {
        utilities.executeCallback(callback, result)
      }, params)
    },

    getTrailByUID: function (batch_uid, callback) {
      var queryObject = {
        uid: batch_uid,
        vertex_type: 'PRODUCT_BATCH'
      }

      this.getTrail(queryObject, callback)
    },

    getTrailByQuery: function (queryObject, callback) {
      queryObject.vertex_type = 'PRODUCT_BATCH'

      this.getTrail(queryObject, callback)
    },

    hashTrail: function (trail, start_vertex_uid) {
      var BFStraversal = graph.BFS(trail, start_vertex_uid, true)

      for (var i in BFStraversal) {
        if (BFStraversal[i].outbound != undefined) {
          delete BFStraversal[i].outbound
        }
      }

      for (var i in BFStraversal) {
        BFStraversal[i] = utilities.sortObject(BFStraversal[i])
      }

      var BFStraversalS = JSON.stringify(BFStraversal)

      // Import log entry
      fs.appendFile('import-log.txt', '\n\n-----------------\n UID: ' + start_vertex_uid + '\n\nUID hash: ' + utilities.sha3(start_vertex_uid) + '\n\nTraversal: ' + BFStraversalS + '\n\nTraversal hashed: ' + utilities.sha3(BFStraversalS) + '\n\n-----------------\n\n', 'utf8', function () {})

      return utilities.sha3(BFStraversalS)
    }

  }

  return product
}
