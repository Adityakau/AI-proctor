FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY target/dashboard-api-*.jar app.jar
EXPOSE 8084
ENTRYPOINT ["java","-jar","/app/app.jar"]

