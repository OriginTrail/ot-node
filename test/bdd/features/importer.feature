Feature: Test basic importer features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @second
  Scenario: Check that second WOT import does not mess up first import's hash value (same data set)
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/json_examples/WOT_Example_1.json" as WOT
    Given DC initiates the replication for last imported dataset
    And DC waits for last offer to get written to blockchain
    And I remember previous import's fingerprint value
    And DC imports "importers/json_examples/WOT_Example_2.json" as WOT
    Then DC's last import's hash should be the same as one manually calculated
    Then checking again first import's root hash should point to remembered value

  @second
  Scenario: Check that WOT import is connecting to the same batch from GS1 import
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    And DC imports "importers/json_examples/WOT_Example_1.json" as WOT
    Then the traversal from batch "urn:epc:id:sgtin:Batch_1" should contain 1 trail and 2 vertices of type EVENT

  @first
  Scenario: Query locally
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then DC's last import's hash should be the same as one manually calculated
    Given I create json query with path: "identifiers.uid", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ"
    Then the last query should return same id as last import's




