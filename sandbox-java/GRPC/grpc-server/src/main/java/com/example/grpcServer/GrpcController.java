package com.example.grpcServer;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
public class GrpcController {

    private HelloServiceImpl helloServiceImpl;

    @Autowired
    GrpcController(HelloServiceImpl helloServiceImpl) {
        this.helloServiceImpl = helloServiceImpl;
    }

    @RequestMapping(value = "/rest", method = RequestMethod.POST)
    public String sayHello(@RequestBody HelloRequestForRest request) {

        return new StringBuilder().append("Hello, ")
                .append(request.getFirstName())
                .append(" ")
                .append(request.getLastName())
                .toString();
    }
}
