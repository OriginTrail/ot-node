Feature: Test basic network features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Start network with 5 nodes and check do they see each other
    Given I setup 5 nodes
    And I start the nodes
    Then all nodes should be aware of each other

  Scenario: Test replication DC -> DH
    Given the replication factor is 5
    And I setup 5 nodes
    And I start the nodes
    And I use 1st node as DC
    And I import "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml"
    Then the last import's hash should be the same as one manually calculated
