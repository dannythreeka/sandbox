package com.danny.webhookline.currencyConversion;

import lombok.Data;

import java.util.ArrayList;

@Data
public class LineSenderRequest {
    private ArrayList<LineMessageRequest> events;

    @Data
    public class LineMessageRequest {
        private String replyToken;
        private String type;
        private String timestamp;
        private Source source;
        private Message message;
    }
    @Data
    public class Source{
        private String type;
        private String userId;
    }

    @Data
    public class Message{
        private String id;
        private String type;
        private String text;
    }
}
