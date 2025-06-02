# GRPC Server(downstream server)
## GRPC 
https://grpc.io/
## Technology Stack

Line Linkage Web runs on/with:

Tool        | Version   | 
-----------:| :-------- |
JDK         | 1.8.0.172 or newer 
Gradle      | 2.14.1 or newer
Spring Boot | 2.0.5.RELEASE

Line Linkage Web dependency:

Tool        | Version   | URL
-----------:| :-------- |:-------:
GRPC | 1.15.0 |[GRPC](https://grpc.io/ "link")
LogNet | 2.3.2 | [grpc-spring-boot-starter](https://github.com/LogNet/grpc-spring-boot-starter "link")


## Generate Proto
```
./gradlew generateProto
```

## Build

```
./gradlew clean build
```