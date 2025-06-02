package com.danny.webhookline.currencyConversion;

import com.linecorp.bot.model.response.BotApiResponse;

public interface LineService {
    BotApiResponse replyLineMessage(String message, String replyToken);
}
