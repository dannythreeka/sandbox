package com.danny;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemWriter;
import org.springframework.batch.item.database.BeanPropertyItemSqlParameterSourceProvider;
import org.springframework.batch.item.database.JdbcBatchItemWriter;
import org.springframework.batch.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.batch.item.file.FlatFileItemReader;
import org.springframework.batch.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.batch.item.file.mapping.BeanWrapperFieldSetMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import javax.management.MXBean;
import javax.sql.DataSource;

@Configuration
public class BatchTaskWorker {

    private static final Logger log = LoggerFactory.getLogger(BatchJobNotificationListener.class);

    @Bean
    public ItemWriter<Person> consoleItemWriter() {
        ItemWriter<Person> writer = items ->
                items.stream().forEach(
                        item -> log.info("This item: " + item.toString())
                );

        return writer;
    }

    @Bean
    public FlatFileItemReader<Person> flatFileItemReader() {
        return new FlatFileItemReaderBuilder<Person>()
                .name("personItemReader")
                .resource(new ClassPathResource("sample-data.csv"))
                .delimited()
                .names(new String[]{"firstName", "lastName"})
                .fieldSetMapper(new BeanWrapperFieldSetMapper<Person>() {{
                    setTargetType(Person.class);
                }})
                .build();
    }

    @Bean
    public JdbcBatchItemWriter<Person> jdbcBatchItemWriter(DataSource dataSource) {
        return new JdbcBatchItemWriterBuilder<Person>()
                .itemSqlParameterSourceProvider(new BeanPropertyItemSqlParameterSourceProvider<>())
                .sql("INSERT INTO people (first_name, last_name) VALUES (:firstName, :lastName)")
                .dataSource(dataSource)
                .build();
    }

    @Bean
    public ItemProcessor<Person, Person> personItemProcessor() {
        ItemProcessor<Person, Person> personItemProcessor = person -> {
            final Person transformedPerson = new Person(person.getFirstName().toUpperCase(), person.getLastName().toUpperCase());
            log.info("New Person after personItemProcessor: " + transformedPerson.toString());

            return transformedPerson;
        };
        return personItemProcessor;
    }

}
