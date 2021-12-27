# ot-node-v6-poc
OT-Node v6 beta 1


## Publish

curl --location --request POST 'http://127.0.0.1:8900/publish' \
--form 'file=@"/Users/miloskotlar/dkg-data-service/data/example.jsonld"' \
--form 'topics="topic1"'


#### JSON-LD example

```json

{
  "@context": "http://schema.org/",
  "@id": "0x12345",
  "metadata": {
    "@type": "dataset",
    "dataModel": "RDF",
    "timestamp": "2021-09-13T11:00:00.000Z",
    "topics": ["topic1", "topic2"]
  },
  "operations": {
    "permissionedGroups": {
      "PG1": ["node1"]
    }
  },
  "data1": [
    {
      "@id": "ObjectEvent1",
      "restrictedAccess": "pgid1",
      "action": "OBSERVE",
      "bizStep": "urn:epcglobal:cbv:bizstep:shipping",
      "disposition": "urn:epcglobal:cbv:disp:in_transit",
      "epcList": ["urn:epc:id:sgtin:0614141.107346.5555"],
      "quantityList": [
        {"epcClass":"urn:epc:id:sgtin:0614141.107346.5555","quantity":50,"uom":"KGM"}
      ],
      "eventTime": "2021-01-01T20:33:31.116000-06:00",
      "eventTimeZoneOffset": "-06:00",
      "readPoint": {
        "id": "urn:epc:id:sgln:0614141.07346.1234"
      },
      "bizTransactionList": [  {"type": "urn:epcglobal:cbv:btt:po", "bizTransaction": "http://transaction.acme.com/po/12345678" }  ]
    }
  ]
}

```


## Resolve

curl --location --request POST 'http://127.0.0.1:8900/resolve' \
--form 'uri="0x5101a29369f0a16b6d17855197515511c9da75c8aa530ac95193a1a55510795e"'


## Discover

curl --location --request POST 'http://127.0.0.1:8900/discover' \
--form 'topics="topic1"'

## Query

curl --location --request POST 'http://127.0.0.1:8901/query' \
--form 'query="PREFIX schema: <http://schema.org/>
SELECT ?s (schema:quantity as ?p) ?o
WHERE {
    ?s  schema:quantity ?o .
}"' \
--form 'topics="topic1"'


