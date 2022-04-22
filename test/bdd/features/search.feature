Feature: Searching for assets on the DKG
    Background: Setup local blockchain, bootstraps and nodes
        Given the blockchain is set up
        And 1 bootstrap is running

    Scenario: Create an asset with keyword
        Given I setup 4 nodes
        When I call publish on node 1 with validAssertion with keywords:
            | keyword 1 | keyword 2 |
        And I wait for last publish to finalize
        And Last publish finished with status: COMPLETED

    Scenario: Search for an entity with an existing keyword
        Given I setup 4 nodes in my local env
        When I call publish on node 1 with validAssertion with keywords:
            | keyword 1 | keyword 2 |
        And I wait for last publish to finalize
        And Last publish finished with status: COMPLETED
        When I call search on node 1 with keyword:
            | keyword 1 |
        And I wait for search to be finalized
        Then the result of assertion search cannot be 0
        And the search result should be valid
        And I will get the dataset containing the keyword:
            | keyword 1 |
        And I will see the number of nodes that responded
        And I will see the number of assets retrieved

    Scenario: Search for an assertion with an existing keyword
        Given I setup 4 nodes in my local env
        When I search for an assertion with an existing keyword:
            | keyword |
        And I retrieve assertion result with the given handler id
        Then I will get the dataset containing the intial keyword:
            | keyword |


