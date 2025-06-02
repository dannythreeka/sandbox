package com.danny.webhookline.currencyConversion.impl;

import com.danny.webhookline.currencyConversion.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
class CurrencyConvServiceImpl implements CurrencyConvService {

    private final static Logger logger = LoggerFactory.getLogger(CurrencyConvServiceImpl.class);

    @Value("${currency.url}")
    private String url;

    private RestTemplate restTemplate;

    CurrencyConvServiceImpl(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public CurrencyResponse getCurrencyResponse(LineSenderRequest.LineMessageRequest lineMessageRequest) {
        CurrencyResponse res = new CurrencyResponse();
        res.setReplyToken(lineMessageRequest.getReplyToken());

        CurrencyConvRequest request = getCurrencyConvRequest(lineMessageRequest.getMessage().getText().trim());
        if (request != null) {
            CurrencyConvResponse response = getCurrencyConvResponse(request.getSource(), request.getTarget());
            res.setMessage(getMessage(response, request.getSource(), request.getTarget()));
        }else{
            res.setMessage("NICE");
        }
        return res;
    }

    private CurrencyConvRequest getCurrencyConvRequest(String message) {
        String[] text = message.split("=");
        if (text.length == 2) {
            CurrencyConvRequest currencyConvRequest = new CurrencyConvRequest();
            currencyConvRequest.setSource(text[0].toUpperCase());
            currencyConvRequest.setTarget(text[1].toUpperCase());
            return currencyConvRequest;
        }
        return null;
    }

    private CurrencyConvResponse getCurrencyConvResponse(String source, String target) {
        String urlString = UriComponentsBuilder.fromHttpUrl(url).queryParam("base", source).queryParam("symbols", target).toUriString();

        try {
            ResponseEntity<CurrencyConvResponse> response = restTemplate.getForEntity(urlString, CurrencyConvResponse.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                return response.getBody();
            }
        }catch (HttpClientErrorException | HttpServerErrorException e){
            logger.error(e.getMessage());
        }
        return null;
    }

    private String getMessage(CurrencyConvResponse response, String source, String target) {
        if(response != null) {
            StringBuilder builder = new StringBuilder();
            return builder.append(source + ": 1.00" + " => ").append(target + ": " + response.getRates().get(target)).toString();
        }
        return "Unable to retrieve the currency information";

    }
}
