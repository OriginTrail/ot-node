@fourth
Feature: Parent identity creditor features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Expect node to add a sub-identity
    Given I setup 2 nodes
    And I start the nodes
    Then the 1st node should have a valid ERC725 identity
    And the 2nd node should have a valid ERC725 identity
    Then I set up the 1st node as the parent of the 2nd node

  Scenario: Expect node to create offer from parent identity
    Given I setup 5 nodes
    And I start the nodes
    Given I set up the 1st node as the parent of the 2nd node
    And I stop the 1nd node
    And I stop the 2nd node
    And I add the 1st node erc identity as the parent in the 2nd node config
    And I start the 2nd node
    And I use 2nd node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1
    Then DC's last import's hash should be the same as one manually calculated
    Given DC initiates the replication for last imported dataset
    And I wait for replications to finish
    Then the last root hash should be the same as one manually calculated
    Then the last import should be the same on all nodes that replicated data
