package com.danny.facebook

import com.danny.core.OAuthClient
import com.danny.core.OAuthClientConfig
import com.danny.core.OAuthConstant
import com.danny.facebook.exception.FacebookAccessTokenException
import org.apache.http.client.methods.HttpGet
import org.apache.http.client.utils.URIBuilder
import org.apache.http.util.EntityUtils
import org.apache.http.impl.client.HttpClients

/**
 * FACEBOOK OAuth Client which provided the OAuth function
 * For Grant Type: Authorization Code
 *
 * @author Danny Wang <dannythreekai@gmail.com>
 */
class FacebookOAuthClient: OAuthClient {

    private val SCHEME = "https"
    private val PORT = 443
    private val LOGIN_DIALOG_HOST = "www.facebook.com"
    private val LOGIN_DIALOG_PATH = "v3.1/dialog/oauth"
    private val GRAPH_API_HOST = "graph.facebook.com"
    private val GRAPH_API_PATH = "v3.1/oauth/access_token"

    override fun authorizeUser(client: OAuthClientConfig): String{
        return URIBuilder().setScheme(SCHEME).setHost(LOGIN_DIALOG_HOST).setPort(PORT)
                .setPath(LOGIN_DIALOG_PATH).setParameter(OAuthConstant.CLIENT_ID, client.getClientId())
                .setParameter(OAuthConstant.SCOPE, client.getScope())
                .setParameter(OAuthConstant.REDIRECT_URI, client.getRedirectUri()).build().toString()
    }

    override fun newTokenRequest(client: OAuthClientConfig, authorizationCode: String): String{
        val httpGet = HttpGet(getRequestTokenUri(client, authorizationCode))
        try {
            val httpResponse = HttpClients.createDefault().execute(httpGet)
            if (httpResponse.statusLine.statusCode === 200) {
                val httpEntity = httpResponse.entity
                return  EntityUtils.toString(httpEntity)
            } else
                httpGet.abort()
        } catch (e: Exception) {
            throw FacebookAccessTokenException(e.message.toString())
        }
        return ""
    }

    private fun getRequestTokenUri(client: OAuthClientConfig, authorizationCode: String): String{
        return URIBuilder().setScheme(SCHEME).setHost(GRAPH_API_HOST).setPort(PORT)
                .setPath(GRAPH_API_PATH).setParameter(OAuthConstant.CLIENT_ID, client.getClientId())
                .setParameter(OAuthConstant.CLIENT_SECRET, client.getClientSecret())
                .setParameter(OAuthConstant.REDIRECT_URI, client.getRedirectUri())
                .setParameter(OAuthConstant.CODE, authorizationCode).build().toString()
    }

}