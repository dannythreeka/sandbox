# GRPC in Java sandbox

## Start the GRPC server application (Downstream server)
```
./gradlew bootRun
```

Server application will host rest controller on 8888 port and rpc on 6565 port.

## Start the GRPC client application (Upstream server)
```
./gradlew bootRun
```

### Test GRPC
```
curl http://localhost:8080/grpc
```
Client application will send the request to server application via gRPC.

### Test Rest
```
curl http://localhost:8080/rest
```
Client application will send the request to server application via regular HTTP channel.