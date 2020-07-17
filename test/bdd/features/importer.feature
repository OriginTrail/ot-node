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
    And DC imports "importers/xml_examples/Retail/02_Green_to_Pink_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    And I call traversal from "id" "urn:epc:id:sgtin:Batch_1" with connection types "EPC"
    Then the last traversal should contain 3 objects in total

  @first
  Scenario: Check that exported WOT dataset is the same as the one imported
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/json_examples/kakaxi.wot" as WOT
    And DC waits for import to finish
    When DC exports the last imported dataset as WOT
    And DC waits for export to finish
    Then the last exported dataset data should be the same as "importers/json_examples/kakaxi.wot"

  @first
  Scenario: Fetching entity by different identifiers
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/use_cases/perutnina_kakaxi/perutnina_gs1.xml" as GS1-EPCIS
    And DC waits for import to finish
    Given I create json query with path: "lot", value: "1201700337" and opcode: "EQ"
    Given DC node makes local query with previous json query
    Given I create json query with path: "id", value: "urn:ot:object:batch:id:2223068000005:2019-09-11T00:00:00+02:00:1201700337" and opcode: "EQ"
    Given DC node makes local query with previous json query
    Then the last two queries should return the same object

  @first
  Scenario: Check that simple trail returns objects from two datasets which are connected via connectors
    Given I setup 1 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/use_cases/connectors/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC imports "importers/use_cases/connectors/02_Green_to_Pink_receipt.xml" as GS1-EPCIS
    And DC waits for import to finish
    And I call traversal from "id" "connectionId" with connection types "CONNECTION_DOWNSTREAM"
    Then the last traversal should contain 2 objects in total

  @third
  Scenario: Return all data related to a specific identifier
    Given I setup 4 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/use_cases/OBE/ORDER100678.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then I call traversal from "sgtin" "urn:epc:idpat:sgtin:100678" with connection types "EPC"
    Then the last traversal should contain 5 objects in total
    And I calculate and validate the proof of the last traversal

  @fourth
  Scenario: Check import non-blocking API
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS
    Then DC checks status of the last import
    And The last import status should be "PENDING"

  @first
  Scenario: Get issuer identity
    Given I setup 4 node
    And I start the node
    And I use 1st node as DC
    And DC imports "importers/use_cases/OBE/CARTONDATA.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I use 4th node as DC
    And DC gets issuer id for element "1234567890000000015"
    And I use 1st node as DC
    Then DC should be the issuer for the selected element

  @third
  Scenario: Check that two OT-JSON 1.1 datasets with different order have different hashes
    Given the replication difficulty is 0
    And I setup 4 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/use_cases/otjson_1.1/sort1.json" as GRAPH
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I use 3rd node as DV
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    And I use 2nd node as DC
    And DC imports "importers/use_cases/otjson_1.1/sort2.json" as GRAPH
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last two exported datasets from 1st and 2nd node should not have the same hashes

  @fourth
  Scenario: Check that two OT-JSON 1.2 datasets with different order have the same hashes
    Given the replication difficulty is 0
    And I setup 4 node
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/use_cases/otjson_1.2/sort1.json" as GRAPH
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I use 1st node as DV
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    And DC imports "importers/use_cases/otjson_1.2/sort2.json" as GRAPH
    And DC waits for import to finish
    When DV exports the last imported dataset as OT-JSON
    And DV waits for export to finish
    Then the last two exported datasets from 1st and 1st node should have the same hashes