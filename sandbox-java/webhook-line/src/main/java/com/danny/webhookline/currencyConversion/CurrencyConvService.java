package com.danny.webhookline.currencyConversion;


public interface CurrencyConvService {
    CurrencyResponse getCurrencyResponse(LineSenderRequest.LineMessageRequest lineMessageRequest);
}