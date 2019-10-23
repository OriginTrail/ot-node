Feature: Test basic importer features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @second
  Scenario: Check that imported GS1 dataset has a valid signature
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    When DC exports the last imported dataset as OT-JSON
    And DC waits for export to finish
    Then the last exported dataset signature should belong to DC

  @third
  Scenario: Check that exported GS1 dataset is the same as the one imported
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    When DC exports the last imported dataset as GS1-EPCIS
    And DC waits for export to finish
    Then the last exported dataset data should be the same as "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml"

#  @skip
#  Scenario: Check that second WOT import does not mess up first import's hash value (same data set)
#    Given I setup 1 node
#    And I start the node
#    And I use 1st node as DC
#    And DC imports "importers/json_examples/WOT_Example_1.json" as WOT
#    And DC waits for import to finish
#    Given DC initiates the replication for last imported dataset
#    And DC waits for last offer to get written to blockchain
#    And I remember previous import's fingerprint value
#    And DC imports "importers/json_examples/WOT_Example_2.json" as WOT
#    And DC waits for import to finish
#    Then DC's last import's hash should be the same as one manually calculated
#    Then checking again first import's root hash should point to remembered value
#
#  @skip
#  Scenario: Check that WOT import is connecting to the same batch from GS1 import
#    Given I setup 1 node
#    And I start the node
#    And I use 1st node as DC
#    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
#    And DC imports "importers/json_examples/WOT_Example_1.json" as WOT
#    Then the traversal from batch "urn:epc:id:sgtin:Batch_1" should contain 1 trail and 2 vertices of type EVENT
