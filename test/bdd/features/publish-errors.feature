Feature: Publish errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  #@publish-errors
  #Scenario: Publish on a node with invalid data path
    #Given I setup 3 nodes
    #And I setup node 4 with appDataPath set to \0
    #And I wait for 10 seconds
    #And I call publish on node 4 with validAssertion
    #Then Last PUBLISH operation finished with status: PublishRouteError

  @publish-errors
  Scenario: Publish on a node with minimum replication factor greater than the number of nodes
    Given I setup 1 nodes
    And I call publish on node 1 with validAssertion
    Then Last PUBLISH operation finished with status: PublishStartError

  @publish-errors
  Scenario: Publish an asset directly on the node
    Given I setup 1 nodes
    And I call publish on ot-node 1 directly with validPublishRequestBody
    And I wait for last publish to finalize
    Then Last PUBLISH operation finished with status: PublishValidateAssertionError
#
#

