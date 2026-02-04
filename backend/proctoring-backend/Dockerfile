# --- STAGE 1: Build the App (Using Java 17 Maven image) ---
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# 1. Copy pom.xml and src
COPY pom.xml .
COPY src ./src

# 2. Build the JAR
RUN mvn clean package -DskipTests

# --- STAGE 2: Run the App (Using Java 17 Runtime) ---
FROM eclipse-temurin:17-jdk-alpine
VOLUME /tmp

# 3. Copy the built JAR from the previous stage
COPY --from=build /app/target/*.jar app.jar

ENTRYPOINT ["java","-jar","/app.jar"]
EXPOSE 8080