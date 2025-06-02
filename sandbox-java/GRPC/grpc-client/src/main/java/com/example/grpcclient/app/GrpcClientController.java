package com.example.grpcclient.app;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GrpcClientController {

    private GrpcClientService grpcClientService;

    @Autowired
    GrpcClientController(GrpcClientService grpcClientService) {
        this.grpcClientService = grpcClientService;
    }

    @RequestMapping(path = "/grpc")
    public String useGrpc() {
        return grpcClientService.requestRemoteServerByGrpc();
    }

    @RequestMapping(path = "/rest")
    public String useRest() {
        return grpcClientService.requestRemoteServerByRest();
    }
}
