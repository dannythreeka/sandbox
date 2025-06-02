package com.danny;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.configuration.annotation.JobBuilderFactory;
import org.springframework.batch.core.configuration.annotation.StepBuilderFactory;
import org.springframework.batch.core.launch.support.RunIdIncrementer;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemWriter;
import org.springframework.batch.item.database.JdbcBatchItemWriter;
import org.springframework.batch.item.file.FlatFileItemReader;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableBatchProcessing
public class BatchConfiguration {

    private JobBuilderFactory jobBuilderFactory;
    private StepBuilderFactory stepBuilderFactory;

    BatchConfiguration(JobBuilderFactory jobBuilderFactory, StepBuilderFactory stepBuilderFactory) {
        this.jobBuilderFactory = jobBuilderFactory;
        this.stepBuilderFactory = stepBuilderFactory;
    }

    @Bean
    public Job job(BatchJobNotificationListener listener, Step stepFileToDb, Step stepFileToConsole) {
        return jobBuilderFactory.get("job")
                .incrementer(new RunIdIncrementer())
                .listener(listener)
                .flow(stepFileToDb)
                .next(stepFileToConsole)
                .end()
                .build();
    }

    @Bean
    public Step stepFileToDb(ItemProcessor<Person, Person> personItemProcessor, FlatFileItemReader<Person> flatFileItemReader, JdbcBatchItemWriter<Person> jdbcBatchItemWriter) {
        return stepBuilderFactory.get("stepFileToDb")
                .<Person, Person>chunk(10)
                .reader(flatFileItemReader)
                .processor(personItemProcessor)
                .writer(jdbcBatchItemWriter)
                .build();
    }

    @Bean
    public Step stepFileToConsole(FlatFileItemReader<Person> flatFileItemReader, ItemWriter<Person> consoleItemWriter) {
        return stepBuilderFactory.get("stepFileToConsole")
                .<Person, Person>chunk(10)
                .reader(flatFileItemReader)
                .writer(consoleItemWriter)
                .build();
    }
}
