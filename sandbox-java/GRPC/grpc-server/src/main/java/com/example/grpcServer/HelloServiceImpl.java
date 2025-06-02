package com.example.grpcServer;

import io.grpc.examples.helloworld.*;
import io.grpc.stub.StreamObserver;
import org.lognet.springboot.grpc.GRpcService;
import org.springframework.stereotype.Service;

@Service
@GRpcService
public class HelloServiceImpl extends HelloServiceGrpc.HelloServiceImplBase {

    @Override
    public void hello(
            HelloRequest request, StreamObserver<HelloResponse> responseObserver) {
        responseObserver.onNext(getHelloResponse(request));
        responseObserver.onCompleted();
    }

    public HelloResponse getHelloResponse(HelloRequest request){
        String greeting = new StringBuilder().append("Hello, ")
                .append(request.getFirstName())
                .append(" ")
                .append(request.getLastName())
                .toString();

        return HelloResponse.newBuilder().setGreeting(greeting).build();
    }
}