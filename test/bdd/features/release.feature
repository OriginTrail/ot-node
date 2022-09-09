Feature: Release related tests
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @release
  Scenario: Node is able to publish on the network, expect status completed on publish result
    Given I setup 4 nodes
    When I call publish on node 1 with validAssertion
    And Last publish finished with status: COMPLETED

  @release
  Scenario: Node is able to get result of the operation previously published
    Given I setup 4 nodes
    When I call publish on node 1 with validAssertion
    And Last publish finished with status: COMPLETED
    And I get operation result from node 1 for last published assertion
    And Last operation finished with status: COMPLETED
    And I setup 1 additional node
    And I get operation result from node 5 for last published assertion
    And Last operation finished with status: COMPLETED
