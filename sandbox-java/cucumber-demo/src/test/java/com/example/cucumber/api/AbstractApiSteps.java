package com.example.cucumber.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.util.Map;
import java.util.logging.Logger;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import org.glassfish.jersey.filter.LoggingFilter;

abstract public class AbstractApiSteps {

    protected static ObjectMapper MAPPER = new ObjectMapper();

    private WebTarget target;

    private Map<String, Object> headers;

    private Response response;

    abstract protected Map<String, Object> setHeaders();

    abstract protected String getBaseUrl();

    public AbstractApiSteps() {
        this.headers = setHeaders();
        Client client = ClientBuilder.newClient();
        // uncomment to see actual request in the logs
        client = client.register(new LoggingFilter(Logger.getLogger(this.getClass().getName()), true));
        this.target = client.target(getBaseUrl());
    }

    private Invocation.Builder getRequest(String path, Map<String, String> queryMap) {
        WebTarget newTarget = this.target.path(path);
        if (queryMap != null) {
            for (Map.Entry entry : queryMap.entrySet()) {
                newTarget = newTarget.queryParam(entry.getKey().toString(), entry.getValue());
            }
        }

        Invocation.Builder request = newTarget.request();
        if (headers != null) {
            for (Map.Entry entry : headers.entrySet()) {
                request.header(entry.getKey().toString(), entry.getValue());
            }
        }
        return request;
    }

    protected Response getResponse() {
        return this.response;
    }

    protected void setResponse(Response response) {
        this.response = response;
    }

    protected String getBasicAuth(String user, String pass) {
        return String.format("Basic %s", Base64.getEncoder().encodeToString((user + ":" + pass).getBytes()));
    }

    protected Response doGet(String path, Map<String, String> queryMap) {
        return this.getRequest(path, queryMap).get();
    }

    protected Response doPost(String path, Map<String, String> queryMap, Object model, String mediaType) {
        return this.getRequest(path, queryMap).post(Entity.entity(model, mediaType));
    }

    protected Response doPut(String path, Map<String, String> queryMap, Object model, String mediaType) {
        return this.getRequest(path, queryMap).put(Entity.entity(model, mediaType));
    }

    protected Response doDelete(String path) {
        return this.target.path(path).request().delete();
    }
}
