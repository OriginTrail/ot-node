Feature: ERC725 Profile features
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @second
  Scenario: Expect node to create profile
    Given I setup 1 node
    And I start the node
    Then the 1st node should have a valid ERC725 identity
    And the 1st node should have a valid profile

  @second
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

  @second
  Scenario: Provide own ERC725 identity and expect node to create profile
    Given I setup 1 node
    When I manually create ERC725 identity for 1st node
    And I use the created ERC725 identity in 1st node
    And I start the node
    Then the 1st node should have a valid ERC725 identity
    And the 1st node should have a valid profile

  @second
  Scenario: Expect node to have a non-empty management wallet
    Given I setup 1 node
    And I start the node
    Then the 1st node should have a management wallet

  @second
  Scenario: Expect node to have a valid management wallet
    Given I setup 1 node
    And I start the node
    Then the 1st node should have a valid management wallet

  @second
  Scenario: Expect node to have a default management wallet if it is not provided
    Given I setup 1 node
    And I override configuration using variables for all nodes
      | management_wallet | node_wallet |
    And I start the node
    Then the 1st node should have a default management wallet