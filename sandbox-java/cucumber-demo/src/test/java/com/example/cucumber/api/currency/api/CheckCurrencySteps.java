package com.example.cucumber.api.currency.api;

import com.example.util.JsonUtils;
import com.example.cucumber.api.AbstractApiSteps;
import com.example.cucumber.api.currency.model.CurrencyRateModel;
import com.github.fge.jackson.JsonLoader;
import cucumber.api.java.en.Given;
import cucumber.api.java.en.Then;
import cucumber.api.java.en.When;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import javax.ws.rs.core.HttpHeaders;
import org.junit.Assert;

public class CheckCurrencySteps extends AbstractApiSteps {

    private CurrencyRateModel model;
    private String responseJsonString;

    @Override
    protected Map<String, Object> setHeaders() {
        Map<String, Object> headers = new HashMap<>();
        headers.put(HttpHeaders.CONTENT_TYPE, "application/json");
        return headers;
    }

    @Override
    protected String getBaseUrl() {
        return "https://api.exchangeratesapi.io";
    }

    @Given("^a base currency: \"([^\"]*)\" and target currency: \"([^\"]*)\"$")
    public void a_base_currency_and_target_currency(String base, String symbols) {
        this.model = new CurrencyRateModel(base, symbols);
    }

    @When("^System calls the Currency API to check currency rate$")
    public void system_calls_the_Currency_API_to_check_currency_rate() {
        Map<String, String> queryMap = new HashMap<>();
        queryMap.put("base", this.model.getBase());
        queryMap.put("symbols", this.model.getSymbols());
        setResponse(doGet("/latest", queryMap));
    }

    @Then("^Currency API should respond with (\\d+)$")
    public void currency_API_should_respond_with(int expectedStatusCode) throws IOException {
        responseJsonString = getResponse().readEntity(String.class);
        Assert.assertEquals(expectedStatusCode, getResponse().getStatus());
    }

    @Then("^the response is valid according to the \"([^\"]*)\" schema$")
    public void the_response_is_valid_according_to_the_schema(String schemaName) throws Throwable {
        String text = JsonLoader.fromResource("/schemas/" + schemaName).toString();
        System.out.println(text);
        Assert.assertTrue(JsonUtils.validateJsonSchema(responseJsonString,text));
    }

}
