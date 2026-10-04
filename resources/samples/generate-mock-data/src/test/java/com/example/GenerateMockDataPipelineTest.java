package com.example;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.Serializable;
import org.apache.beam.sdk.testing.PAssert;
import org.apache.beam.sdk.testing.TestPipeline;
import org.apache.beam.sdk.transforms.Create;
import org.apache.beam.sdk.transforms.DoFn;
import org.apache.beam.sdk.transforms.ParDo;
import org.apache.beam.sdk.values.PCollection;
import org.apache.beam.sdk.values.PCollectionTuple;
import org.apache.beam.sdk.values.TupleTagList;
import org.junit.Rule;
import org.junit.Test;

public class GenerateMockDataPipelineTest implements Serializable {

    @Rule
    public final transient TestPipeline testPipeline = TestPipeline.create();

    public static class ValidateJsonSchemaFn extends DoFn<String, Boolean> {
        private transient ObjectMapper mapper;

        @Setup
        public void setup() {
            mapper = new ObjectMapper();
        }

        @ProcessElement
        public void processElement(@Element String json, OutputReceiver<Boolean> out) {
            try {
                JsonNode node = mapper.readTree(json);
                boolean valid = node.hasNonNull("id")
                        && node.hasNonNull("name")
                        && node.hasNonNull("email")
                        && node.hasNonNull("signup_date")
                        && node.get("id").asInt() >= 1
                        && node.get("id").asInt() <= 100;
                out.output(valid);
            } catch (Exception e) {
                out.output(false);
            }
        }
    }

    @Test
    public void testMockDataGeneration() {
        PCollection<Long> input = testPipeline.apply("CreateInput", Create.of(1L, 2L));

        PCollectionTuple results = input.apply(
                "GenerateMockData",
                ParDo.of(new GenerateMockDataPipeline.GenerateMockDataFn(2))
                        .withOutputTags(GenerateMockDataPipeline.VALID_TAG, TupleTagList.of(GenerateMockDataPipeline.ERROR_TAG))
        );

        PCollection<Boolean> validations = results.get(GenerateMockDataPipeline.VALID_TAG)
                .apply("ValidateSchema", ParDo.of(new ValidateJsonSchemaFn()));

        PAssert.that(validations).containsInAnyOrder(true, true, true, true);

        testPipeline.run().waitUntilFinish();
    }
}
