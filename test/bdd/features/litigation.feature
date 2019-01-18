Feature: Test basic network features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @itworks
  Scenario: Test replication DC -> DH
    Given the replication difficulty is 0
    And I setup 8 nodes
    And I start the nodes
    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last root hash should be the same as one manually calculated
    Then the last import should be the same on all nodes that replicated data
    And I stop 1 holder
    And I wait for litigation initiation
    And I start stopped holder
