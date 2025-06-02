package com.example.cucumber.api.currency.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CurrencyRateModel {

    @JsonProperty("base")
    private String base;
    @JsonProperty("symbols")
    private String symbols;

    public CurrencyRateModel(String base, String symbols) {
        this.base = base;
        this.symbols = symbols;
    }
}
