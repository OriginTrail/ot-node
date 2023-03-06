Feature: Update asset test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Publishing a valid assertion
    Given I set R1 to be 2
    Given I setup 4 nodes
    And I wait for 10 seconds
    When I call publish on node 4 with validAssertion
    Then Last PUBLISH operation finished with status: COMPLETED

  Scenario: Update an existing asset
    Given I call update with validUAL and updated assertionData
    And I call get directly to ot-node 1 with validUAL
    And I wait for <number> seconds
    When Last UPDATE operation finished with status: COMPLETED
    Then I call get directly to ot-node 2 with validUAL
    And I get operation result from node 2 for last updated assertion

