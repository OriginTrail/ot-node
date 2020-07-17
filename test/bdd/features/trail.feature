

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
