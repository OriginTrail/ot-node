Feature: Publish errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running


  @publish-errors
  Scenario: Publish on a node with minimum replication factor greater the number of nodes
    Given I setup 3 nodes
    Given I setup node 4 with minimumAckResponses.publish set to '10'
    When I call publish on node 4 with validAssertion
    And Last PUBLISH operation finished with status: PublishStartError


  @publish-errors
  Scenario: Publish an asset directly on the node
    Given I setup 4 nodes
    When I call publish on ot-node 4 directly with validPublishRequestBody
    And I wait for last publish to finalize
    And Last PUBLISH operation finished with status: PublishValidateAssertionError


  @publish-errors
  Scenario: Publish on a node with invalid data path
    Given I setup 3 nodes
    Given I setup node 4 with appDataPath set to '\0'
    When I call publish on node 4 with validAssertion
    And Last PUBLISH operation finished with status: PublishRouteError
#
#

