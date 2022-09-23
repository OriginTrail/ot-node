Feature: Publish errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running
    And I setup 3 nodes

  @publish-errors
  Scenario: Publish on a node with minimum replication factor greater than the number of nodes
    And I setup node 4 with minimumAckResponses.publish set to 10
    And I wait for 4 seconds
    And I call publish on node 4 with validAssertion
    Then Last PUBLISH operation finished with status: PublishStartError

  @publish-errors
  Scenario: Publish an asset directly on the node
    Given I setup 1 node
    And I wait for 4 seconds
    And I call publish on ot-node 4 directly with validPublishRequestBody
    And I wait for last publish to finalize
    Then Last PUBLISH operation finished with status: PublishValidateAssertionError

  @publish-errors
  Scenario: Publish on a node with invalid data path
    And I setup node 4 with appDataPath set to \0
    And I wait for 4 seconds
    And I call publish on node 4 with validAssertion
    Then Last PUBLISH operation finished with status: PublishRouteError
#
#

