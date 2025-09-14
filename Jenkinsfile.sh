pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'yourdockerhub/todo-api:latest'
    }

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/yourusername/todo-api-app.git'
            }
        }

        stage('SonarQube Scan') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh """
                        sonar-scanner \
                        -Dsonar.projectKey=todo-api \
                        -Dsonar.sources=. \
                        -Dsonar.host.url=http://localhost:9000 \
                        -Dsonar.login=your-sonar-token
                    """
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE} ."
            }
        }

        stage('Push Docker Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-hub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh "docker login -u $DOCKER_USER -p $DOCKER_PASS"
                    sh "docker push ${DOCKER_IMAGE}"
                }
            }
        }

        stage('Trigger ArgoCD Deploy') {
            steps {
                echo 'ArgoCD will detect changes in Git'
            }
        }
    }
}
