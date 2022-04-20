Feature: Querying assets on the DKG

    Scenario: Querying the assertion by keyword on the DKG
        Given query request is sent for the keyword
            | keyword |
        When the query result status is COMPLETED
        Then the query result response data should contain triplets
        And data integrity can be validated using triplet value
            | triplet |
        And root hash should matched