package com.danny.webhookline.currencyConversion;

import lombok.Data;

@Data
public class CurrencyConvRequest {
    private String source;
    private String target;
}
