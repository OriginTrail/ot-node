// External modules
var utilities = require('./utilities')()
var database = require('./database')()

var config = utilities.getConfig()
var MAX_PATH_LENGTH = parseInt(config.MAX_PATH_LENGTH)

module.exports = function () {
  var graph = {
    getVertices: function (queryObject, callback) {
      queryString = 'FOR v IN ot_vertices '

      if (utilities.isEmptyObject(queryObject) == false) {
        queryString += 'FILTER '

        var filters = []

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

        queryString += filters.join(' AND ')
      }

      queryString += ' RETURN v'

      database.runQuery(queryString, function (result) {
        utilities.executeCallback(callback, result)
      }, params)
    },

    getTraversal: function (start_vertex, callback) {
      if (start_vertex == undefined || start_vertex._id == undefined) {
        utilities.executeCallback(callback, [])
        return
      }

      queryString = `FOR v, e, p IN 1 .. ${MAX_PATH_LENGTH}
					       OUTBOUND '${start_vertex._id}'
					       GRAPH 'origintrail_graph'
					       RETURN p`

      database.runQuery(queryString, callback)
    },

    convertToVirtualGraph: function (raw_graph_data) {
      var vertices = {}
      var edges = {}
      var list = {}

      for (i in raw_graph_data) {
        if (raw_graph_data[i].edges != undefined) {
          for (j in raw_graph_data[i].edges) {
            if (raw_graph_data[i].edges[j] != null) {
              raw_graph_data[i].edges[j].key = raw_graph_data[i].edges[j]._key
              raw_graph_data[i].edges[j].from = raw_graph_data[i].edges[j]._from.split('/')[1]
              raw_graph_data[i].edges[j].to = raw_graph_data[i].edges[j]._to.split('/')[1]
              delete raw_graph_data[i].edges[j]._key
              delete raw_graph_data[i].edges[j]._id
              delete raw_graph_data[i].edges[j]._rev
              delete raw_graph_data[i].edges[j]._to
              delete raw_graph_data[i].edges[j]._from

              var key = raw_graph_data[i].edges[j].key

              if (edges[key] == undefined) {
                edges[key] = raw_graph_data[i].edges[j]
              }
            }
          }
        }

        if (raw_graph_data[i].vertices != undefined) {
          for (j in raw_graph_data[i].vertices) {
            if (raw_graph_data[i].vertices[j] != null) {
              raw_graph_data[i].vertices[j].key = raw_graph_data[i].vertices[j]._key
              raw_graph_data[i].vertices[j].outbound = []
              delete raw_graph_data[i].vertices[j]._key
              delete raw_graph_data[i].vertices[j]._id
              delete raw_graph_data[i].vertices[j]._rev

              var key = raw_graph_data[i].vertices[j].key

              if (vertices[key] == undefined) {
                vertices[key] = raw_graph_data[i].vertices[j]
              }
            }
          }
        }
      }

      for (i in vertices) {
        list[vertices[i].key] = vertices[i]
      }

      for (i in edges) {
        list[edges[i].from].outbound.push(edges[i])
      }

      graph = {}
      graph['data'] = list

      return graph
    },

    BFS: function (trail, start_vertex_uid, restricted = false) {
      var visited = []
      var traversalArray = []

      var start_vertex = null

      for (var i in trail) {
        if (trail[i].uid == start_vertex_uid) {
          start_vertex = i
          break
        }
      }

      if (start_vertex != null) {
        var queue = []
        queue.push(start_vertex)

        visited[start_vertex] = true

        while (queue.length > 0) {
          var curr = queue.shift()

          if (trail[curr] == undefined) {
            continue
          }

          traversalArray.push(trail[curr])

          for (var i in trail[curr].outbound) {
            var e = trail[curr].outbound[i]
            var w = e.to

            if (e.edge_type != 'EVENT_CONNECTION') {
              traversalArray.push(e)
            }

            if (visited[w] == undefined && trail[w] != undefined && (restricted == false || (restricted == true && trail[w].vertex_type != 'PRODUCT_BATCH' && e.edge_type != 'EVENT_CONNECTION'))) {
              visited[w] = true
              queue.push(w)
            }
          }
        }

        for (i in traversalArray) {
          if (traversalArray[i]._checked != undefined) {
            delete traversalArray[i]._checked
          }
        }

        return traversalArray
      } else {
        return traversalArray
      }
    }
  }

  return graph
}
