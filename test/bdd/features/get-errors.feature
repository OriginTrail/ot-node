Feature: Get errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running
    And I setup 4 nodes
    And I wait for 4 seconds

  @get-errors
  Scenario: Getting non existent UAL
    And I call get directly to ot-node 1 with nonExistentUAL
    And I wait for last get to finalize
    Then Last GET operation finished with status: GetAssertionIdError

  @get-errors
  Scenario: GET operation result on a node with minimum replication factor greater than the number of nodes
    And I call publish on node 1 with validAssertion
    Then Last PUBLISH operation finished with status: COMPLETED
    When I setup node 5 with minimumAckResponses.get set to 10
    And I wait for 4 seconds
    And I get operation result from node 5 for last published assertion
    And I wait for last get to finalize
    Then Last GET operation finished with status: GetNetworkError


