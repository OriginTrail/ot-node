Feature: Test basic network features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @itworks
  Scenario: Start network with 5 nodes and check do they see each other
    Given I setup 5 nodes
    And I start the nodes
    Then all nodes should be aware of each other

  @itworks
  Scenario: Test replication DC -> DH
    Given the replication difficulty is 0
    And I setup 5 nodes
    And I start the nodes
    And I use 1st node as DC
    And I import "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then the last import's hash should be the same as one manually calculated
    Given I initiate the replication
    And I wait for replications to finish
    Then the last import should be the same on all nodes that replicated data

  @itworks
  Scenario: Check that second gs1 import does not mess up first import's hash value
    Given I setup 4 nodes
    And I start the nodes
    And I use 1st node as DC
    And I import "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Given I initiate the replication
    And I wait for 10 seconds
    And I remember previous import's fingerprint value
    And I import "importers/xml_examples/Basic/02_Green_to_pink_shipment.xml" as GS1
    And I initiate the replication
    And I wait for 10 seconds
    Then checking again first import's root hash should point to remembered value

  @doesntwork
  Scenario: Check that second wot import does not mess up first import's hash value
    Given I setup 4 nodes
    And I start the nodes
    And I use 1st node as DC
    And I import "importers/json_examples/WOT_Example_1.json" as WOT
    Given I initiate the replication
    And I wait for 10 seconds
    And I remember previous import's fingerprint value
    And I import "importers/json_examples/WOT_Example_2.json" as WOT
    And I initiate the replication
    And I wait for 10 seconds
    Then checking again first import's root hash should point to remembered value

  @itworks
  Scenario: Smoke check data-layer basic endpoints
    Given I setup 2 nodes
    And I start the nodes
    And I use 1st node as DC
    And I import "importers/xml_examples/Basic/01_Green_to_pink_shipment.xml" as GS1
    Given I query DC node locally with path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ"
    Then response should contain only last imported data set id
    Given I query DC node locally for last imported data set id
    Then response hash should match last imported data set id

  @itworks
  Scenario: DC->DH->DV replication + DV network read + DV purchase
    Given the replication difficulty is 0
    And I setup 5 nodes
    And I start the nodes
    And I use 1st node as DC
    And I import "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then the last import's hash should be the same as one manually calculated
    Given I initiate the replication
    And I wait for replications to finish
    Then the last import should be the same on all nodes that replicated data
    Given I additionally setup 1 node
    And I start additional nodes
    And I use 6th node as DV
    Given DV publishes query consisting of path: "identifiers.id", value: "urn:epc:id:sgtin:Batch_1" and opcode: "EQ" to the network
    Then all nodes with last import should answer to last network query
    Given the DV purchase import from the last query from a DH
    Then the last import should be the same on all nodes that purchased data

  @itworks
  Scenario: Smoke check /api/withdraw endpoint
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    Given I attempt to withdraw 5 tokens from DC profile
    Then DC wallet and DC profile balances should diff by 5 with rounding error of 0.1

  @itworks
  Scenario: Smoke check /api/deposit endpoint
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    Given I attempt to deposit 50 tokens from DC wallet
    Then DC wallet and DC profile balances should diff by 50 with rounding error of 0.1

  @itworks
  Scenario: Smoke check /api/consensus endpoint
    Given I setup 1 node
    And I start the node
    And I use 1st node as DC
    And I import "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    And I import "importers/xml_examples/Retail/02_Green_to_Pink_receipt.xml" as GS1
    Given DC calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Green"
    Then last consensus response should have 1 event with 1 match
    Given DC calls consensus endpoint for sender: "urn:ot:object:actor:id:Company_Pink"
    Then last consensus response should have 1 event with 1 match

