Feature: Release related tests
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running


  Scenario: Send publish request, expect publish result returns success
    Given I setup 4 nodes
    And I call publish route successfully on node 1 with keyword:
      | test-keyword-1 | test-keyword-2 |
