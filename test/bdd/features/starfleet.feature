Feature: Multiple blockchain related features
  Background: Setup multiple blockchains
    Given the blockchains are set up
    And 1 bootstrap is running

  @pending
  Scenario: Check that node will fail to initialize if it's missing funds
    Given I setup 1 node
    And the 1st node's spend all the Ethers
    And I start the node without waiting
    Then the 1st node should fail to initialize a profile