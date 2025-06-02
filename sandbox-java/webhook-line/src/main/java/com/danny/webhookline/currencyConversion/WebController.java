package com.danny.webhookline.currencyConversion;

import com.google.gson.Gson;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;


@RestController
@RequestMapping("/v1")
public class WebController {

    private final static Logger logger = LoggerFactory.getLogger(WebController.class);

    private CurrencyConvService currencyConvService;
    private LineService lineService;
    private Gson gson;

    public WebController(CurrencyConvService currencyConvService, LineService lineService, Gson gson) {
        this.currencyConvService = currencyConvService;
        this.lineService = lineService;
        this.gson=gson;
    }

    /**
     * Endpoint for Line webhook.
     * @param request
     */
    @RequestMapping("/webhook")
    public String chatbot(@RequestBody String request, HttpServletRequest httpServletRequest) {
        logger.info("IP: " + httpServletRequest.getRemoteAddr(), "params: " +  request);


        LineSenderRequest lineSenderRequest = gson.fromJson(request, LineSenderRequest.class);

        lineSenderRequest.getEvents().stream().filter(s -> s.getType().equals("message"))
                .map(req -> currencyConvService.getCurrencyResponse(req))
                .forEach(res -> {
                    lineService.replyLineMessage(res.getMessage(), res.getReplyToken());
                });

        return lineSenderRequest.toString();
    }

    /**
     * Endpoint for health check
     * @return
     */
    @GetMapping("ping")
    public String ping() {
        return "pong";
    }
}
