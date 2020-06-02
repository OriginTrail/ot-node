Feature: Backwards compatibility
  Background: Setup local blockchain and bootstraps
    Given the blockchain is set up
    And 1 bootstrap is running

  @backwards_compatibility
  Scenario: Backwards compatibility
    And I start the network via script
    And I manually add nodes
#    And I use 1st node as DC
    And DC imports "importers/xml_examples/Retail/01_Green_to_pink_shipment.xml" as GS1-EPCIS


