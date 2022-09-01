Feature: Publish errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

#TODO: needs to be investigated; publish completes even with invalid configuration///publishing from a different client
  @publish-errors
  Scenario: Node is not able to publish on a node with invalid configuration
    Given I setup publish node with invalid configuration
    Given I setup 3 nodes
    When I call publish on node 1 with validAssertion
    And Last publish finished with status: PublishStartError


#  @publish-errors
#  Scenario: Node is not able to validate assertion on the network
#    Given I setup 4 nodes
#    When I call publish on ot-node 1 directly with invalidPublishRequestBody
#    And I wait for last publish to finalize
#    And Last publish finished with status: PublishValidateAssertionError

