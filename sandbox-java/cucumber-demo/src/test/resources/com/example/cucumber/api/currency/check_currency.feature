@test
Feature: check the currency rate
  @feature1
  Scenario Outline: As feature1 tester, I want to check the currency rate with correct unit.
    Given a base currency: <base> and target currency: <symbols>
    When System calls the Currency API to check currency rate
    Then Currency API should respond with <status_code>
    Then the response is valid according to the <schema> schema

    Examples:
      | base  | symbols | status_code | schema                      |
      | "USD" | "USD"   | 200         | "currency_rate_schema.json" |

  @feature2
  Scenario Outline: As feature2 tester, I want to check the currency rate with incorrect unit.
    Given a base currency: <base> and target currency: <symbols>
    When System calls the Currency API to check currency rate
    Then Currency API should respond with <status_code>
    Then the response is valid according to the <schema> schema

    Examples:
      | base  | symbols | status_code | schema                            |
      | "AAA" | "USD"   | 400         | "currency_rate_error_schema.json" |
      | "BBB" | "USD"   | 400         | "currency_rate_error_schema.json" |