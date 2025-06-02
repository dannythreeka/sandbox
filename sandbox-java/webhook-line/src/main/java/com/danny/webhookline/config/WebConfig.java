package com.danny.webhookline.config;

import com.google.gson.Gson;
import com.linecorp.bot.client.LineMessagingClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class WebConfig {

    @Value("${line.accessToken}")
    private String lineAccessToken;

    @Bean
    public RestTemplate getRestTemplate() {
        return new RestTemplate();
    }

    @Bean
    public LineMessagingClient getLineMessagingClient() {
        return LineMessagingClient
                .builder(lineAccessToken).build();
    }

    @Bean
    public Gson getGson(){
        return new Gson();
    }

}
