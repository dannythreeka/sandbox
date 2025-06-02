package com.danny.core

/**
 * OAuth Client which provided the OAuth function
 * For Grant Type: Authorization Code
 *
 * @author Danny Wang <dannythreekai@gmail.com>
 */
interface OAuthClient {

    /**
     * Authorize user and return the login dialog url
     * Note: user need to implement the redirect flow
     *
     * @param client client configuration
     * @return the redirect authorization uri of Auth server
     */
    fun authorizeUser(client: OAuthClientConfig): String

    /**
     * Create new access token from Authorization Code
     *
     * @param client client configuration
     * @param authorizationCode Authorization Code issued from Auth server
     * @return Access Token Response
     */
    fun newTokenRequest(client: OAuthClientConfig, authorizationCode: String): String
}