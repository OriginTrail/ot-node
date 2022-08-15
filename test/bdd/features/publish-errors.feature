Feature: Publish errors test
  Background: Setup local blockchain, bootstraps and nodes
    Given the blockchain is set up
    And 1 bootstrap is running

#  Scenario: Node is not able to start publish on the network with valid assertion
#    Given I setup 4 nodes
#    When I call publish on node 1 with validAssertion
#    And I wait for last publish to finalize
#    And Last publish finished with status: PUBLISH_START_ERROR
#

  Scenario: Node is not able to validate assertion on the network
    Given I setup 4 nodes
    When I call publish on ot-node 1 directly with invalidPublishRequestBody
    And I wait for 15 seconds and check operationId status
    And Last publish finished with status: PublishValidateAssertionError

#  Scenario: Node is not able to store publish result in the local database
#    Given I setup 4 nodes
#    When I call publish on node 1 with validAssertion
#    And I wait for last publish to finalize
#    And Last publish failed to store publish result with error: publishLocalStoreError
#
#  Scenario: Node is not able to store publish init commands during the publish process
#    Given I setup 4 nodes
#    When I call publish on node 1 with validAssertion
#    And I wait for last publish to finalize
#    And Last publish failed to store publish init commands with error: publishStoreInitError
#
#  Scenario: Node is not able to store publish request during the publish process
#    Given I setup 4 nodes
#    When I call publish on node 1 with validAssertion
#    And I wait for last publish to finalize
#    And Last publish failed to store publish request with error: publishStoreRequestError
#
#  Scenario: Node is not able to find node during the publish process
#    Given I setup 4 nodes
#    When I call publish on node 1 with validAssertion
#    And I wait for last publish to finalize
#    And Last publish failed to find node with error: publishFindNodesError
#
#  Scenario: Node is not able to finalized publish on the network with valid assertion
#    Given I setup 4 nodes
#    When I call publish on node 1 with validAssertion
#    And I wait for last publish to finalize
#    And Last publish failed with error: publishError
#
#
#
