# --- Stage 1: Build Java Application ---
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# --- Stage 2: Flex Template Runtime Image ---
FROM gcr.io/dataflow-templates-base/java17-template-launcher-base:1.1
WORKDIR /template
COPY --from=builder /app/target/main.jar /template/main.jar
ENV FLEX_TEMPLATE_JAVA_CLASSPATH=/template/main.jar
ENV FLEX_TEMPLATE_JAVA_MAIN_CLASS=com.example.{{pipeline_class_name}}

# Container Hardening: Ensure template permissions for runner execution
RUN chmod -R a+rx /template
