package com.danny.webhookline.external.line;

import lombok.Data;

@Data
public class ClientAccessTokenRequest {
    private String grant_type;
    private String client_id;
    private String client_secret;
}
