Feature: Release related tests
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

#  Scenario: Get info route returns expected version
#    Given I setup 1 node
#    When I call info route on node 1
#    Then The node version should start with number 6

  @release
  Scenario: Node is able to publish on the network, expect status completed on publish result
    Given I setup 4 nodes
    When I call publish on node 1 with validAssertion with keywords:
    | keyword 1 | keyword 2 |
    And I wait for last publish to finalize
    And Last publish finished with status: COMPLETED

  @skip
  Scenario: Node is able to resolve assertion previously published
    Given I setup 4 nodes
    When I call publish on node 1 with validAssertion with keywords:
      | keyword 1 | keyword 2 |
    And I wait for last publish to finalize
    And Last publish finished with status: COMPLETED
    And I setup 1 additional node
    And I call resolve on node 5 with keywords:
      | keyword 1 |
    And I wait for resolve to finalize
    And Last resolve finished with status: COMPLETED
    And Last reoslve returned valid result
