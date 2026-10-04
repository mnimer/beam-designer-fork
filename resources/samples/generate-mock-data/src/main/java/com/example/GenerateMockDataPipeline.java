package com.example;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.text.SimpleDateFormat;
import java.util.concurrent.TimeUnit;
import net.datafaker.Faker;
import org.apache.beam.sdk.Pipeline;
import org.apache.beam.sdk.io.GenerateSequence;
import org.apache.beam.sdk.options.Default;
import org.apache.beam.sdk.options.Description;
import org.apache.beam.sdk.options.PipelineOptions;
import org.apache.beam.sdk.options.PipelineOptionsFactory;
import org.apache.beam.sdk.options.StreamingOptions;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.transforms.MapElements;
import org.apache.beam.sdk.transforms.ParDo;
import org.apache.beam.sdk.values.PCollection;
import org.apache.beam.sdk.values.PCollectionTuple;
import org.apache.beam.sdk.values.TupleTag;
import org.apache.beam.sdk.values.TupleTagList;
import org.apache.beam.sdk.values.TypeDescriptors;
import org.joda.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Pipeline that periodically generates mock user data using Datafaker,
 * parses and validates JSON payloads with error routing, and logs the records.
 */
public class GenerateMockDataPipeline {

    private static final Logger LOG = LoggerFactory.getLogger(GenerateMockDataPipeline.class);

    public static final TupleTag<String> VALID_TAG = new TupleTag<String>() {};
    public static final TupleTag<String> ERROR_TAG = new TupleTag<String>() {};

    public interface MockDataPipelineOptions extends PipelineOptions, StreamingOptions {
        @Description("Unique pipeline execution identifier")
        @Default.String("generate-mock-data-pipeline")
        String getPipelineJobId();
        void setPipelineJobId(String value);

        @Description("Number of mock objects to generate per iteration")
        @Default.Integer(1)
        Integer getNumObjectsPerIteration();
        void setNumObjectsPerIteration(Integer value);
    }

    public static class GenerateMockDataFn extends DoFn<Long, String> {
        private final int numObjectsPerIteration;
        private transient Faker faker;
        private transient ObjectMapper objectMapper;
        private transient SimpleDateFormat dateFormat;

        public GenerateMockDataFn(int numObjectsPerIteration) {
            this.numObjectsPerIteration = numObjectsPerIteration;
        }

        @Setup
        public void setup() {
            faker = new Faker();
            objectMapper = new ObjectMapper();
            dateFormat = new SimpleDateFormat("yyyy-MM-dd");
        }

        @ProcessElement
        public void processElement(@Element Long sequenceValue, MultiOutputReceiver out) {
            int count = Math.max(1, numObjectsPerIteration);
            for (int i = 0; i < count; i++) {
                try {
                    ObjectNode root = objectMapper.createObjectNode();
                    root.put("id", faker.number().numberBetween(1, 101));
                    root.put("name", faker.name().fullName());
                    root.put("email", faker.internet().emailAddress());
                    root.put("signup_date", dateFormat.format(faker.date().past(365 * 5, TimeUnit.DAYS)));

                    String jsonOutput = objectMapper.writeValueAsString(root);
                    out.get(VALID_TAG).output(jsonOutput);
                } catch (Exception e) {
                    LOG.error("Error generating mock record for sequence iteration {}: {}", sequenceValue, e.getMessage());
                    out.get(ERROR_TAG).output(String.format("{\"error\": \"%s\", \"sequence\": %d}", e.getMessage(), sequenceValue));
                }
            }
        }
    }

    public static void main(String[] args) {
        MockDataPipelineOptions options =
                PipelineOptionsFactory.fromArgs(args).withValidation().as(MockDataPipelineOptions.class);

        Pipeline pipeline = Pipeline.create(options);

        // 1. Source: GenerateSequence trigger
        PCollection<Long> sequences = pipeline.apply(
                "trigger",
                GenerateSequence.from(0L)
                        .withRate(1L, Duration.standardSeconds(1L))
        );

        // 2. ParDo: Generate mock data with branching output and DLQ routing
        PCollectionTuple mockDataTuple = sequences.apply(
                "generate mock data",
                ParDo.of(new GenerateMockDataFn(options.getNumObjectsPerIteration()))
                        .withOutputTags(VALID_TAG, TupleTagList.of(ERROR_TAG))
        );

        // 3. Step: Log valid messages
        mockDataTuple.get(VALID_TAG).apply(
                "Log Message",
                MapElements.into(TypeDescriptors.strings()).via((String record) -> {
                    LOG.info("Log: {}", record);
                    return record;
                })
        );

        // 4. Handle DLQ / Error messages
        mockDataTuple.get(ERROR_TAG).apply(
                "Log Errors",
                MapElements.into(TypeDescriptors.strings()).via((String errorRecord) -> {
                    LOG.warn("DLQ Error Record: {}", errorRecord);
                    return errorRecord;
                })
        );

        pipeline.run();
    }
}
