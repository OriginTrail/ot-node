Feature: Release related tests
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @release
  Scenario: Publishing a valid assertion
    Given I setup 4 nodes
    And I wait for 5 seconds
    When I call publish on node 4 with validAssertion
    Then Last PUBLISH operation finished with status: COMPLETED

  @release
  Scenario: Getting a result of the previously published assertion
    Given I setup 4 nodes
    And I wait for 10 seconds
    When I call publish on node 4 with validAssertion
    And Last PUBLISH operation finished with status: COMPLETED
    And I get operation result from node 4 for last published assertion
    And Last GET operation finished with status: COMPLETED
    And I setup 1 additional node
    And I wait for 10 seconds
    And I get operation result from node 5 for last published assertion
    Then Last GET operation finished with status: COMPLETED
