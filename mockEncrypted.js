const Encryption = require('./modules/Encryption');

const jsonRaw = '{\n' +
    '  "@graph": [\n' +
    '    {\n' +
    '      "@type": "otObject",\n' +
    '      "@id": "urn:uuid:8b964788-64d6-4007-8d47-c663788aa6fb",\n' +
    '      "identifiers": [\n' +
    '        {\n' +
    '          "@type": "uuid",\n' +
    '          "@value": "urn:uuid:8b964788-64d6-4007-8d47-c663788aa6fb"\n' +
    '        }\n' +
    '      ],\n' +
    '      "relations": [\n' +
    '        {\n' +
    '          "@type": "otRelation",\n' +
    '          "direction": "direct",\n' +
    '          "linkedObject": {\n' +
    '            "@id": "urn:epc:idpat:sgtin:4012345.098765.*"\n' +
    '          },\n' +
    '          "properties": {\n' +
    '            "relationType": "CHILD_EPC_QUANTITY",\n' +
    '            "quantity": "10"\n' +
    '          }\n' +
    '        },\n' +
    '        {\n' +
    '          "@type": "otRelation",\n' +
    '          "direction": "direct",\n' +
    '          "linkedObject": {\n' +
    '            "@id": "urn:epc:class:lgtin:4012345.012345.998877"\n' +
    '          },\n' +
    '          "properties": {\n' +
    '            "relationType": "CHILD_EPC_QUANTITY",\n' +
    '            "quantity": "200.5",\n' +
    '            "uom": "KGM"\n' +
    '          }\n' +
    '        },\n' +
    '        {\n' +
    '          "@type": "otRelation",\n' +
    '          "direction": "direct",\n' +
    '          "linkedObject": {\n' +
    '            "@id": "urn:epc:id:sgln:0614141.00888.0"\n' +
    '          },\n' +
    '          "properties": {\n' +
    '            "relationType": "BIZ_LOCATION"\n' +
    '          }\n' +
    '        },\n' +
    '        {\n' +
    '          "@type": "otRelation",\n' +
    '          "direction": "direct",\n' +
    '          "linkedObject": {\n' +
    '            "@id": "urn:epc:id:sgln:0614141.00777.0"\n' +
    '          },\n' +
    '          "properties": {\n' +
    '            "relationType": "READ_POINT"\n' +
    '          }\n' +
    '        },\n' +
    '        {\n' +
    '          "@type": "otRelation",\n' +
    '          "direction": "direct",\n' +
    '          "linkedObject": {\n' +
    '            "@id": "urn:epc:id:sscc:0614141.1234567890"\n' +
    '          },\n' +
    '          "properties": {\n' +
    '            "relationType": "PARENT_EPC"\n' +
    '          }\n' +
    '        },\n' +
    '        {\n' +
    '          "@type": "otRelation",\n' +
    '          "direction": "direct",\n' +
    '          "linkedObject": {\n' +
    '            "@id": "urn:epc:id:sgtin:0614141.107346.2017"\n' +
    '          },\n' +
    '          "properties": {\n' +
    '            "relationType": "CHILD_EPC"\n' +
    '          }\n' +
    '        },\n' +
    '        {\n' +
    '          "@type": "otRelation",\n' +
    '          "direction": "direct",\n' +
    '          "linkedObject": {\n' +
    '            "@id": "urn:epc:id:sgtin:0614141.107346.2018"\n' +
    '          },\n' +
    '          "properties": {\n' +
    '            "relationType": "CHILD_EPC"\n' +
    '          }\n' +
    '        }\n' +
    '      ],\n' +
    '      "properties": {\n' +
    '        "objectType": "AggregationEvent",\n' +
    '        "___metadata": {\n' +
    '          "eventTime": null,\n' +
    '          "eventTimeZoneOffset": null,\n' +
    '          "parentID": null,\n' +
    '          "childEPCs": [\n' +
    '            {\n' +
    '              "epc": [\n' +
    '                null,\n' +
    '                null\n' +
    '              ]\n' +
    '            }\n' +
    '          ],\n' +
    '          "action": null,\n' +
    '          "bizStep": null,\n' +
    '          "disposition": null,\n' +
    '          "readPoint": {\n' +
    '            "id": null\n' +
    '          },\n' +
    '          "bizLocation": {\n' +
    '            "id": null\n' +
    '          },\n' +
    '          "extension": {\n' +
    '            "childQuantityList": [\n' +
    '              {\n' +
    '                "quantityElement": [\n' +
    '                  {\n' +
    '                    "epcClass": null,\n' +
    '                    "quantity": null\n' +
    '                  },\n' +
    '                  {\n' +
    '                    "epcClass": null,\n' +
    '                    "quantity": null,\n' +
    '                    "uom": null\n' +
    '                  }\n' +
    '                ]\n' +
    '              }\n' +
    '            ]\n' +
    '          },\n' +
    '          "example:myField": null\n' +
    '        },\n' +
    '        "eventTime": "2013-06-08T14:58:56.591Z",\n' +
    '        "eventTimeZoneOffset": "+02:00",\n' +
    '        "parentID": "urn:epc:id:sscc:0614141.1234567890",\n' +
    '        "childEPCs": [\n' +
    '          {\n' +
    '            "epc": [\n' +
    '              "urn:epc:id:sgtin:0614141.107346.2017",\n' +
    '              "urn:epc:id:sgtin:0614141.107346.2018"\n' +
    '            ]\n' +
    '          }\n' +
    '        ],\n' +
    '        "action": "OBSERVE",\n' +
    '        "bizStep": "urn:epcglobal:cbv:bizstep:receiving",\n' +
    '        "disposition": "urn:epcglobal:cbv:disp:in_progress",\n' +
    '        "readPoint": {\n' +
    '          "id": "urn:epc:id:sgln:0614141.00777.0"\n' +
    '        },\n' +
    '        "bizLocation": {\n' +
    '          "id": "urn:epc:id:sgln:0614141.00888.0"\n' +
    '        },\n' +
    '        "extension": {\n' +
    '          "childQuantityList": [\n' +
    '            {\n' +
    '              "quantityElement": [\n' +
    '                {\n' +
    '                  "epcClass": "urn:epc:idpat:sgtin:4012345.098765.*",\n' +
    '                  "quantity": "10"\n' +
    '                },\n' +
    '                {\n' +
    '                  "epcClass": "urn:epc:class:lgtin:4012345.012345.998877",\n' +
    '                  "quantity": "200.5",\n' +
    '                  "uom": "KGM"\n' +
    '                }\n' +
    '              ]\n' +
    '            }\n' +
    '          ]\n' +
    '        },\n' +
    '        "example:myField": "Example of a vendor/user extension"\n' +
    '      }\n' +
    '    }\n' +
    '  ],\n' +
    '  "@id": "0xed1f77526838025d390809f0e315c4f229e02aa9336a4c278aaf335fb4b0bc26",\n' +
    '  "@type": "Dataset",\n' +
    '  "datasetHeader": {\n' +
    '    "OTJSONVersion": "1.0",\n' +
    '    "datasetCreationTimestamp": "2019-06-06T12:23:50.140Z",\n' +
    '    "datasetTitle": "",\n' +
    '    "datasetTags": [],\n' +
    '    "relatedDatasets": [],\n' +
    '    "validationSchemas": {\n' +
    '      "erc725-main": {\n' +
    '        "schemaType": "ethereum-725",\n' +
    '        "networkId": "rinkeby"\n' +
    '      },\n' +
    '      "merkleRoot": {\n' +
    '        "schemaType": "merkle-root",\n' +
    '        "networkId": "rinkeby"\n' +
    '      }\n' +
    '    },\n' +
    '    "dataIntegrity": {\n' +
    '      "proofs": [\n' +
    '        {\n' +
    '          "proofValue": "0x7dbee90a2e24db526f4c0182c9dcd6017f53a63b35d20acc17f49cd760e93d2a",\n' +
    '          "proofType": "merkleRootHash",\n' +
    '          "validationSchema": "/schemas/merkleRoot"\n' +
    '        }\n' +
    '      ]\n' +
    '    },\n' +
    '    "dataCreator": {\n' +
    '      "identifiers": [\n' +
    '        {\n' +
    '          "identifierValue": "0x25697c931E1AEbC8534017e325C192C7110CB246",\n' +
    '          "identifierType": "ERC725",\n' +
    '          "validationSchema": "/schemas/erc725-main"\n' +
    '        }\n' +
    '      ]\n' +
    '    },\n' +
    '    "transpilationInfo": {\n' +
    '      "transpilationInfo": {\n' +
    '        "transpilerType": "GS1-EPCIS",\n' +
    '        "transpilerVersion": "1.0",\n' +
    '        "sourceMetadata": {\n' +
    '          "created": "2019-06-06T12:23:50.127Z",\n' +
    '          "modified": "2019-06-06T12:23:50.127Z",\n' +
    '          "standard": "GS1-EPCIS",\n' +
    '          "XMLversion": "1.0",\n' +
    '          "encoding": "UTF-8"\n' +
    '        },\n' +
    '        "diff": {}\n' +
    '      },\n' +
    '      "diff": {\n' +
    '        "_declaration": {\n' +
    '          "_attributes": {\n' +
    '            "version": "1.0",\n' +
    '            "encoding": "UTF-8",\n' +
    '            "standalone": "yes"\n' +
    '          }\n' +
    '        },\n' +
    '        "_doctype": "project",\n' +
    '        "epcis:EPCISDocument": {\n' +
    '          "_attributes": {\n' +
    '            "xmlns:epcis": "urn:epcglobal:epcis:xsd:1",\n' +
    '            "xmlns:example": "http://ns.example.com/epcis",\n' +
    '            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",\n' +
    '            "creationDate": "2005-07-11T11:30:47.0Z",\n' +
    '            "schemaVersion": "1.2"\n' +
    '          },\n' +
    '          "EPCISBody": {}\n' +
    '        }\n' +
    '      }\n' +
    '    }\n' +
    '  },\n' +
    '  "signature": {\n' +
    '    "value": "0x1220b00a56168940b9d4588a02aa216b3388d6b7c93b4b9c74bd16486ba34a6f0176f09be1428ac329490a3b32709bdf3f8b3e5feb1963e2ff692fc6b389b7ee1b",\n' +
    '    "type": "ethereum-signature"\n' +
    '  }\n' +
    '}';


const {
    privateKey,
    publicKey,
} = Encryption.generateKeyPair();

const processedJSON = JSON.parse(jsonRaw);

for (const obj of processedJSON['@graph']) {
    if (obj.properties) {
        obj.properties = Encryption.encryptObject(obj.properties, privateKey);

        // obj.properties = Encryption.decryptObject(obj.properties, publicKey);
        // console.log(obj);
    }
}

const encryptedJSON = processedJSON;
console.log(JSON.stringify(processedJSON));
