package com.danny.webhookline.currencyConversion.impl;

import com.danny.webhookline.currencyConversion.LineService;
import com.linecorp.bot.client.LineMessagingClient;
import com.linecorp.bot.model.ReplyMessage;
import com.linecorp.bot.model.message.TextMessage;
import com.linecorp.bot.model.response.BotApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.ExecutionException;

@Service
class LineServiceImpl implements LineService {

    private final static Logger logger = LoggerFactory.getLogger(LineServiceImpl.class);

    private LineMessagingClient lineMessagingClient;

    LineServiceImpl(LineMessagingClient lineMessagingClient) {
        this.lineMessagingClient = lineMessagingClient;
    }

    @Override
    public BotApiResponse replyLineMessage(String message, String replyToken) {

        final TextMessage textMessage = new TextMessage(message);
        final ReplyMessage replyMessage = new ReplyMessage(replyToken,
                textMessage);

        try {
            BotApiResponse res = lineMessagingClient.replyMessage(replyMessage).get();
            return res;
        } catch (InterruptedException | ExecutionException e) {
            logger.error(e.getMessage());
            return null;
        }
    }
}
