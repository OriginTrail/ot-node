Feature: Test basic importer features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Check that second WOT import does not mess up first import's hash value (same data set)
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/json_examples/WOT_Example_1.json" as WOT
    Given DC initiates the replication
    And I wait for 10 seconds
    And I remember previous import's fingerprint value
    And DC imports "importers/json_examples/WOT_Example_2.json" as WOT
    Then the last import's hash should be the same as one manually calculated
    Then checking again first import's root hash should point to remembered value

  Scenario: Check that WOT import is connecting to the same batch from GS1 import
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    And DC imports "importers/json_examples/WOT_Example_1.json" as WOT
    Then the traversal from batch "urn:epc:id:sgtin:Batch_1" should contain 1 trail and 2 vertices of type EVENT
