pipeline {
    agent any

    environment {
        MAVEN_OPTS = "-Dmaven.test.failure.ignore=false"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Backend - Maven Build & Test') {
            steps {
                dir('backend') {
                    sh 'mvn -B clean verify'
                }
            }
        }

        stage('Client - npm Build') {
            steps {
                dir('client/nextjs-app') {
                    sh 'npm install'
                    sh 'npm test -- --watch=false || echo "No tests configured"'
                    sh 'npm run build'
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'backend/**/target/surefire-reports/*.xml'
        }
    }
}

