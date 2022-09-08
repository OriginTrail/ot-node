Feature: Get errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running




  @get-errors
  Scenario: Getting non existent UAL
    Given I setup 4 nodes
    And I wait for 10 seconds
    And I call get directly to ot-node 1 with nonExistentUAL
    And I wait for last resolve to finalize
    Then Last GET operation finished with status: GetAssertionIdError



  @get-errors
  Scenario: GET operation result on a node with minimum replication factor greater than the number of nodes
    Given I setup 4 nodes
    And I wait for 10 seconds
    And I call publish on node 1 with validAssertion
    Then Last PUBLISH operation finished with status: COMPLETED
    When I setup node 4 with minimumAckResponses.get set to 10
    And I wait for 10 seconds
    And I get operation result from node 5 for last published assertion
    And I wait for last resolve to finalize
    Then Last GET operation finished with status: GetNetworkError


#  #Gets stuck on GET_FETCH_FROM_NODES_START
#  @get-errors
#  Scenario: I try to get an assertion as soon as the node is up
#    Given I setup 3 nodes
#    And I setup node 4 with appDataPath set to \0
#    And I wait for 10 seconds
#    And I call publish on node 1 with validAssertion
#    Then Last PUBLISH operation finished with status: COMPLETED
#    And I get operation result from node 4 for last published assertion
#    And I wait for last resolve to finalize
#    Then Last GET operation finished with status: GetNetworkError

