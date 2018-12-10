Feature: Data layer related features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @second
  Scenario: Check that second gs1 import does not mess up first import's hash value
    Given I setup 4 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And I remember previous import's fingerprint value
    And DC imports "importers/xml_examples/Basic/02_Green_to_pink_shipment.xml" as GS1
    And DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    Then checking again first import's root hash should point to remembered value

  @second
  Scenario: Smoke check data-layer basic endpoints
    Given I setup 2 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Given I create json query with path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ"
    And DC node makes local query with previous json query
    Then response should contain only last imported data set id
    Given I query DC node locally for last imported data set id
    Then response hash should match last imported data set id

  @second
  Scenario: Basic dataset integrity with it's xml
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Then imported data is compliant with 01_Green_to_pink_shipment.xml file

  @second
  Scenario: Dataset immutability DC and DH side
    Given I setup 5 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then DC's 2 dataset hashes should match blockchain values
    And I use 2nd node as DH
    Then DH's 2 dataset hashes should match blockchain values


  @second
  Scenario: Dataset immutability II
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And DC imports "importers/xml_examples/Basic/01_Green_to_pink_shipment_modified_event_timestamp.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    Then DC's 2 dataset hashes should match blockchain values

  @second
  Scenario: Imported XML's private data should be hashed
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "test/modules/test_xml/GraphExample_1.xml" as GS1
    Given I query DC node locally for last imported data set id
    Then DC's local query response should contain hashed private attributes
    Given DC initiates the replication for last imported dataset
    And DC waits for replication window to close
    Given I additionally setup 1 node
    And I start additional nodes
    And I use 2nd node as DV
    Given DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then all nodes with last import should answer to last network query by DV
    Given the DV purchases last import from the last query from the DC
    Given I query DV node locally for last imported data set id
    Then DV's local query response should contain hashed private attributes

  @second
  Scenario: Remote event connection on DH and DV
    Given I setup 5 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC imports "importers/xml_examples/Retail/02_Green_to_Pink_receipt.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I use 2nd node as DH
    Given DH calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Green"
    Then last consensus response should have 1 event with 1 match
    Given DH calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Pink"
    Then last consensus response should have 1 event with 1 match
    Given I additionally setup 1 node
    And I start additional nodes
    And I use 6th node as DV
    Given DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then all nodes with last import should answer to last network query by DV
    And the DV purchases last import from the last query from a DH
    Given DV publishes query consisting of path: "uid", value: "urn:epc:id:sgln:Building_Green_V1" and opcode: "EQ" to the network
    Then all nodes with second last import should answer to last network query by DV
    And the DV purchases second last import from the last query from a DH
    And DV calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Pink"
    Then last consensus response should have 1 event with 1 match
    And DV calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Green"
    Then last consensus response should have 1 event with 1 match

  @second
  Scenario: Data location with multiple identifiers
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "test/modules/test_xml/MultipleIdentifiers.xml" as GS1
    Given I create json query with path: "uid", value: "urn:ot:object:product:id:P1" and opcode: "EQ"
    And I append json query with path: "uid", value: "urn:ot:object:product:id:P1" and opcode: "EQ"
    Given DC node makes local query with previous json query
    Then response should contain only last imported data set id