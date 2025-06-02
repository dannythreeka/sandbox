package com.danny.webhookline.external.line;

import lombok.Data;

@Data
public class ClientAccessTokenResponse {
    private String access_token;
    private String expires_in;
    private String token_type;
}
