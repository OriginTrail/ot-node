Feature: Smoke test
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Check that info route is accessible and it returns correct values
    Given I setup 1 node
    And I call info route successfully on node 1

  Scenario: Send publish request, expect publish result returns success
    Given I setup 4 nodes
    And I call publish route successfully on node 1 with keywords
      | test-keyword-1 | test-keyword-2 |
