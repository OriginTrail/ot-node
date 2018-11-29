Feature: ERC725 Profile features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  Scenario: Expect node to create profile
    Given I setup 1 node
    And I start the node
    Then the 1st node should have a valid ERC725 identity
    And the 1st node should have a valid profile

  Scenario: Expect node to create profile and stake only once
    Given I setup 1 node
    And I start the node
    Then the 1st node should have a valid ERC725 identity
    And the 1st node should have a valid profile
    Given I stop the nodes
    # Try to start the node without the money.
    And the 1st node's spend all the Tokens
    And the 1st node's spend all the Ethers
    And I start the node
    Then the 1st node should start normally

  Scenario: Provide own ERC725 identity and expect node to create profile
    Given I setup 1 node
    When I manually create ERC725 identity for 1st node
    And I use the created ERC725 identity in 1st node
    And I start the node
    Then the 1st node should have a valid ERC725 identity
    And the 1st node should have a valid profile
