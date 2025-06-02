package com.example.grpcclient.app;

import io.grpc.ManagedChannel;
import io.grpc.examples.helloworld.HelloRequest;
import io.grpc.examples.helloworld.HelloResponse;
import io.grpc.examples.helloworld.HelloServiceGrpc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

import static com.example.grpcclient.configuration.Const.*;

@Service
public class GrpcClientService {

    private RestTemplate restTemplate;
    private ManagedChannel managedChannel;

    @Value("rest-server.endpoint")
    private String restEndpoint;

    @Value("rest-server.path")
    private String restPath;

    @Autowired
    GrpcClientService(RestTemplate restTemplate, ManagedChannel managedChannel) {
        this.restTemplate = restTemplate;
        this.managedChannel = managedChannel;
    }

    public String requestRemoteServerByGrpc() {
        HelloServiceGrpc.HelloServiceBlockingStub stub = HelloServiceGrpc.newBlockingStub(managedChannel);
        HelloResponse helloResponse = stub.hello(HelloRequest.newBuilder().setFirstName(TEST_FIRST_NAME).setLastName(TEST_LAST_NAME).build());
        return helloResponse.getGreeting();
    }

    public String requestRemoteServerByRest() {
        ResponseEntity<String> responseEntity = restTemplate.postForEntity(restEndpoint + restPath, getHttpRequest(), String.class);
        return responseEntity.getStatusCode().is2xxSuccessful() ? responseEntity.getBody() : "ERROR";
    }

    private HttpEntity<String> getHttpRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, String> body = new HashMap<>();
        body.put(TEST_LAST_NAME_KEY,TEST_LAST_NAME);
        body.put(TEST_FIRST_NAME_KEY,TEST_FIRST_NAME);

        return new HttpEntity(body, headers);
    }
}
