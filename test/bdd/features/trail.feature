

Feature: Trail features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

@fifth
Scenario: Check that trail returns the expected objects
  Given the replication difficulty is 1
  And I setup 4 nodes
  And I start the 1st node
  And I start the 2nd node
  And I start the 3rd node
  And I start the 4th node
  And I use 1st node as DC
  And DC imports "importers/sample_files/DC1_01-sample_product_packing.xml" as GS1-EPCIS
  And DC waits for import to finish
  And DC initiates the replication for last imported dataset
  And I wait for replications to finish
  And DC imports "importers/sample_files/DC1_02-sample_product_shipping.xml" as GS1-EPCIS
  And DC waits for import to finish
  And DC initiates the replication for last imported dataset
  And I wait for replications to finish
  And I use 2nd node as DC
  And DC imports "importers/sample_files/DC2_01-sample_product_receiving.xml" as GS1-EPCIS
  And DC waits for import to finish
  And DC initiates the replication for last imported dataset
  And I wait for replications to finish
  And DC imports "importers/sample_files/DC2_02-sample_transformation_event.xml" as GS1-EPCIS
  And DC waits for import to finish
  And DC initiates the replication for last imported dataset
  And I wait for replications to finish
  And DC imports "importers/sample_files/DC2_03-sample_batch_shipping.xml" as GS1-EPCIS
  And DC waits for import to finish
  And DC initiates the replication for last imported dataset
  And I wait for replications to finish
  And I use 3rd node as DC
  And DC imports "importers/sample_files/DC3_01-sample_batch_receiving.xml" as GS1-EPCIS
  And DC waits for import to finish
  And DC initiates the replication for last imported dataset
  And I wait for replications to finish
  And DC imports "importers/sample_files/DC3_02-sample_batch_selling.xml" as GS1-EPCIS
  And DC waits for import to finish
  And DC initiates the replication for last imported dataset
  And I wait for replications to finish
    # Set 4th node as DC because trail is called from DC node for now -> Expand this functionality in the future
  And I use 4th node as DC
  And I call traversal from "sgtin" "urn:epc:id:sgtin:111111111" with connection types "EPC,PARENT_EPC,CHILD_EPC,INPUT_EPC,OUTPUT_EPC,CONNECTOR_FOR,CONNECTION_DOWNSTREAM"
  Then the last traversal should contain 2 objects with type "otObject.@id" and value "urn:epc:id:sgtin:111111111"
  And the last traversal should contain 2 objects with type "otObject.@id" and value "urn:epc:id:sgtin:999999999"
  And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:888888888"
  And the last traversal should contain 4 objects with type "otObject.@type" and value "otConnector"
  And the last traversal should contain 1 objects with type "otObject.properties.___metadata._attributes.id" and value "packing_product"
  And the last traversal should contain 1 objects with type "otObject.properties.___metadata._attributes.id" and value "shipping_product"
  And the last traversal should contain 1 objects with type "otObject.properties.___metadata._attributes.id" and value "receiving_product"
  And the last traversal should contain 1 objects with type "otObject.properties.___metadata._attributes.id" and value "transforming"
  And the last traversal should contain 1 objects with type "otObject.properties.___metadata._attributes.id" and value "shipping_batch"
  And the last traversal should contain 1 objects with type "otObject.properties.___metadata._attributes.id" and value "receiving_batch"
  And the last traversal should contain 1 objects with type "otObject.properties.___metadata._attributes.id" and value "selling_batch"
  And the last traversal should contain 6 objects with type "otObject.properties.objectType" and value "ObjectEvent"
  And the last traversal should contain 16 objects in total

  @fifth
  Scenario: Check that extended trail returns the more objects than a narrow and a default trail
    Given the replication difficulty is 1
    And I setup 4 nodes
    And I start the 1st node
    And I start the 2nd node
    And I start the 3rd node
    And I start the 4th node
    And I use 1st node as DC
    And DC imports "importers/sample_files/DC1_01-sample_product_packing.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC imports "importers/sample_files/DC1_02-sample_product_shipping.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I use 2nd node as DC
    And DC imports "importers/sample_files/DC2_01-sample_product_receiving.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC imports "importers/sample_files/DC2_02-sample_transformation_event.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC imports "importers/sample_files/DC2_03-sample_batch_shipping.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And I use 3rd node as DC
    And DC imports "importers/sample_files/DC3_01-sample_batch_receiving.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    And DC imports "importers/sample_files/DC3_02-sample_batch_selling.xml" as GS1-EPCIS
    And DC waits for import to finish
    And DC initiates the replication for last imported dataset
    And I wait for replications to finish
    # Set 4th node as DC because trail is called from DC node for now -> Expand this functionality in the future
    And I use 4th node as DC
    When I call traversal from "sgtin" "urn:epc:id:sgtin:111111111" with connection types "EPC,PARENT_EPC,CHILD_EPC,INPUT_EPC,OUTPUT_EPC,CONNECTOR_FOR,CONNECTION_DOWNSTREAM"
    Then the last traversal should contain 16 objects in total
    When I call extended traversal from "sgtin" "urn:epc:id:sgtin:111111111" with connection types "EPC,PARENT_EPC,CHILD_EPC,INPUT_EPC,OUTPUT_EPC,CONNECTOR_FOR,CONNECTION_DOWNSTREAM"
    Then the last traversal should contain 26 objects in total
    When I call narrow traversal from "sgtin" "urn:epc:id:sgtin:111111111" with connection types "EPC,PARENT_EPC,CHILD_EPC,INPUT_EPC,OUTPUT_EPC,CONNECTOR_FOR,CONNECTION_DOWNSTREAM"
    Then the last traversal should contain 16 objects in total


  @fifth
  Scenario: Check that find trail and trail lookup API routes return expected objects
    And I setup 1 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/use_cases/trail/milk.xml" as GS1-EPCIS
    And DC waits for import to finish
    When I call traversal lookup from "serial" "311220" with opcode "EQ"
    Then the last traversal lookup should contain 2 objects with types "serial" and values "311220"
    And the last traversal lookup should contain 1 objects with types "companyPrefix" and values "00100"
    And the last traversal lookup should contain 1 objects with types "companyPrefix" and values "00200"
    And the last traversal lookup should contain 2 objects in total
    When I call traversal lookup from "serial,companyPrefix" "311220,00100" with opcode "IN"
    Then the last traversal lookup should contain 1 objects with types "serial,companyPrefix" and values "311220,00100"
    And the last traversal lookup should contain 1 objects with types "serial,companyPrefix" and values "311220,00200"
    And the last traversal lookup should contain 6 objects in total
    When I send traversal request with included connection types "EPC,PARENT_EPC,CHILD_EPC,INPUT_EPC,OUTPUT_EPC,CONNECTOR_FOR,CONNECTION_DOWNSTREAM" for the last trail lookup request
    Given I wait for trail to finish
    Then the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:class:sgtin:100100.000.311220"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.01"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.02"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.03"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.04"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:class:sgtin:100200.000.311220"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100200.01"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100200.02"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100200.03"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100200.04"
    And the last traversal should contain 20 objects in total
    When I call traversal lookup from "serial,companyPrefix" "311220,00100" with opcode "EQ"
    Then the last traversal lookup should contain 1 objects with types "serial,companyPrefix" and values "311220,00100"
    And the last traversal lookup should contain 1 objects in total
    When I send traversal request with included connection types "EPC,PARENT_EPC,CHILD_EPC,INPUT_EPC,OUTPUT_EPC,CONNECTOR_FOR,CONNECTION_DOWNSTREAM" for the last trail lookup request
    Given I wait for trail to finish
    Then the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:class:sgtin:100100.000.311220"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.01"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.02"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.03"
    And the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:id:sgtin:100100.04"
    And the last traversal should contain 10 objects in total
    When I send traversal request with included connection types "EPC" and excluded connection types "PARENT_EPC,CHILD_EPC,INPUT_EPC,OUTPUT_EPC,CONNECTOR_FOR,CONNECTION_DOWNSTREAM" for the last trail lookup request
    Given I wait for trail to finish
    Then the last traversal should contain 1 objects with type "otObject.@id" and value "urn:epc:class:sgtin:100100.000.311220"
    And the last traversal should contain 1 objects in total

