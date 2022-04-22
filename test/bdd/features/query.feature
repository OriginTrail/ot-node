Feature: Querying assets on the DKG
    Background: Setup local blockchain, bootstraps and nodes
        Given the blockchain is set up
        And 1 bootstrap is running

    Scenario: Querying the assertion by keyword on the DKG
        Given I setup 4 nodes in my local env
        When I send query request on node 1 for the keyword
            | keyword |
        And I wait for last query to be finalized
        And last query finished with status: COMPLETED
        And last query returned valid result
        Then the query result status is COMPLETED
        And the query result response data should contain triplets
        And data integrity can be validated using triplet value
            | triplet |
        And root hash should match