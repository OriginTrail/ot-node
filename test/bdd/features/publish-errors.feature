Feature: Publish errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

#  Scenario: Node is not able to start publish on the network with valid assertion
#    Given I setup publish node 0 with invalid configuration
#    Given I setup 3 nodes
#    When I call publish on node 1 with validAssertion
#   # And I wait for last publish to finalize
#    And Last publish finished with status: PublishStartError

##
  Scenario: Node is not able to validate assertion on the network
    Given I setup 4 nodes
    When I call publish on ot-node 1 directly with invalidPublishRequestBody
    And I wait for 20 seconds and check operation status
    And Last publish finished with status: PublishValidateAssertionError

