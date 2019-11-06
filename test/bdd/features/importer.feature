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

  @third
  Scenario: Check that simple trail returns the expected number of objects
    Given I setup 1 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC imports "importers/xml_examples/Retail/02_Green_to_pink_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then the traversal from id "urn:epc:id:sgtin:Batch_1" with connection types "EPC" should contain 3 objects

  @fourth
  Scenario: Check that trail returns the expected objects
    Given I setup 1 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC imports "importers/xml_examples/Retail/02_Green_to_Pink_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC imports "importers/xml_examples/Retail/03_Pink_to_Orange_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC imports "importers/xml_examples/Retail/04_Pink_to_Orange_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC imports "importers/xml_examples/Retail/05_Pink_to_Red_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC imports "importers/xml_examples/Retail/06_Pink_to_Red_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    Then the traversal from id "urn:epc:id:sgtin:Batch_1" with connection types "EPC,BIZ_LOCATION" should contain 13 objects
    And the last traversal should contain 4 objects with type "otObject.properties.vocabularyType" and value "urn:ot:object:location"
    And the last traversal should contain 3 objects with type "otObject.properties.urn:ot:object:product:batch:productId" and value "urn:ot:object:product:id:Product_1"
    And the last traversal should contain 6 objects with type "otObject.properties.objectType" and value "ObjectEvent"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:Batch_1"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:Batch_1_PINKSHIP2"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:Batch_1_PINKSHIP1"

  @fourth
  Scenario: Check that exported WOT dataset is the same as the one imported
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/json_examples/kakaxi.wot" as WOT
    And DC waits for import to finish
    When DC exports the last imported dataset as WOT
    And DC waits for export to finish
    Then the last exported dataset data should be the same as "importers/json_examples/kakaxi.wot"

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
