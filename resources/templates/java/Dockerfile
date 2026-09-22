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

# Security Hardening (Least Privilege):
# By default, containers run as the root user. To mitigate container escape and privilege escalation
# vulnerabilities in hardened production environments, uncomment the following lines to enforce non-root execution:
# RUN chown -R 1000:1000 /template
# USER 1000:1000

# Container Hardening: Ensure template permissions for runner execution
RUN chmod -R a+rx /template
