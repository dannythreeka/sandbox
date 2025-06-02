package com.danny.webhookline.currencyConversion;

import lombok.Data;

import java.util.Map;

@Data
public class CurrencyConvResponse {
    private String base;
    private String date;
    private Map<String, String> rates;
}
