Feature: Publish errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

  @publish-errors
  Scenario: Publish on a node with minimum replication factor greater than the number of nodes
    Given I setup 1 nodes
    And I wait for 2 seconds

    When I call Publish on the node 1 with validAssertion
    And I wait for latest Publish to finalize
    Then Latest Publish operation finished with status: PublishStartError

  @publish-errors
  Scenario: Publish a knowledge asset directly on the node
    Given I setup 1 nodes
    And I wait for 2 seconds

    When I call Publish directly on the node 1 with validPublishRequestBody
    And I wait for latest Publish to finalize
    Then Latest Publish operation finished with status: ValidateAssetError
