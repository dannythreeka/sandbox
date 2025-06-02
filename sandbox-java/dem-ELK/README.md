Start ELK in docker
```$xslt
cd docker-elk
docker-compose up -d
```

Check Elasticsearch
```$xslt
http://{hostname}:9200
```

Check Kibana
```$xslt
http://{hostname}:5601
```
`hostname: docker-machine ip address`

Start web application
```$xslt
./gradlew bootRun
```

Check test endpoint and trigger log
```$xslt
http://{hostname}:8080/test
```
`hostname: localhost`

Then you should be able to find the log in Kibana.
