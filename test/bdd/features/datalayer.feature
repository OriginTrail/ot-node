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
    Given I query DC node locally with path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ"
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
  Scenario: Dataset immutability I
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    Then DC manually calculated datasets data and root hashes matches ones from blockchain

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
    Given the DV purchases import from the last query from the DC
    Given I query DV node locally for last imported data set id
    Then DV's local query response should contain hashed private attributes

  @only
  Scenario: Remote event connection on DH
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
