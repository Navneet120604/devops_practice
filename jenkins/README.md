# Jenkins Complete CI/CD Guide & Zero-to-Hero Notes

Welcome to the Jenkins DevOps learning repository. This guide covers everything from running Jenkins on Docker, persistent storage, permission management, initial setup, pipeline creation, and common troubleshooting.

---

## 1. Why Did the Initial `docker run` Fail?

When you ran:
```bash
docker run -p 8080:8080 -p 50000:50000 -d \
  -v ./jenkins_home:/var/jenkins_home jenkins/jenkins:lts
```
You received the error:
> `failed to bind host port 0.0.0.0:8080/tcp: address already in use`

### Root Cause:
Port **8080** was already occupied on your host machine by a background process (Node.js/Dev process on PID 2225).

### Solution:
You have two options:
1. **Kill/Stop the conflicting process on 8080**:
   ```bash
   kill -9 $(lsof -t -i:8080)
   ```
2. **OR Map Jenkins to a different host port (Recommended: e.g. 8088)**:
   ```bash
   docker run -d \
     --name jenkins \
     -p 8088:8080 \
     -p 50000:50000 \
     -v ./jenkins_home:/var/jenkins_home \
     jenkins/jenkins:lts
   ```
   *(Web UI will open at `http://localhost:8088`)*

---

## 2. Recommended: Running Jenkins via Docker Compose

In [`/home/nav/devops_practice/jenkins/docker-compose.yaml`](file:///home/nav/devops_practice/jenkins/docker-compose.yaml):

```yaml
services:
  jenkins:
    image: jenkins/jenkins:lts-jdk17
    container_name: jenkins
    restart: unless-stopped
    privileged: true
    user: root
    ports:
      - "8088:8080"    # Web UI (Change 8088 to 8080 if 8080 is freed)
      - "50000:50000"  # Inbound Agent communication
    volumes:
      - ./jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock # Allows Jenkins to build Docker images
    networks:
      - jenkins-net

networks:
  jenkins-net:
    driver: bridge
```

### Start Jenkins:
```bash
docker compose up -d
```

### Check Logs & Status:
```bash
docker compose logs -f
```

---

## 3. Important: Permission on `jenkins_home`

By default, the Jenkins container runs as user `jenkins` (UID `1000`). If you mount a host directory `./jenkins_home`, Jenkins might throw a permission denied error unless ownership is granted:

```bash
sudo chown -R 1000:1000 ./jenkins_home
```
*(In our docker-compose, setting `user: root` or granting `chown 1000:1000` ensures zero permission issues).*

---

## 4. Initial Unlock & Admin Setup

1. Open your browser: **`http://localhost:8088`** (or `8080`).
2. Jenkins will prompt for an **Administrator password**.
3. Retrieve the password from the container:
   ```bash
   docker exec -it jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
   *(Or from the local folder: `cat ./jenkins_home/secrets/initialAdminPassword`)*
4. Paste the password into the browser.
5. Choose **"Install suggested plugins"** (installs Git, Pipeline, Workspace, Credentials, etc.).
6. Create your first Admin User (Username, Password, Full Name, Email).
7. Save and Finish -> **Start using Jenkins**!

---

## 5. Jenkins Core Concepts Cheatsheet

| Concept | Explanation |
| :--- | :--- |
| **Jenkins Master (Controller)** | Schedules build jobs, dispatches builds to agents, monitors agents, records results. |
| **Jenkins Agent (Node)** | Worker machine/container that executes build jobs dispatched by the controller. |
| **Freestyle Project** | GUI-based simple job configuration (good for beginners). |
| **Pipeline (Jenkinsfile)** | Code-based CI/CD pipeline definition (`Declarative` or `Scripted`). Industry standard. |
| **Stage** | A distinct logical phase in a pipeline (e.g., `Build`, `Test`, `Security Scan`, `Deploy`). |
| **Step** | A single task within a stage (e.g., `sh 'npm install'`, `sh 'docker build'`). |
| **Inbound Agent Port (50000)** | TCP port used by remote agents (nodes) to connect back to the Jenkins controller. |

---

## 6. First Declarative Pipeline Example (`Jenkinsfile`)

Once Jenkins is running, create a new item -> **Pipeline** -> copy-paste this sample:

```groovy
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code from Git...'
            }
        }
        stage('Build & Test') {
            steps {
                echo 'Building application...'
                sh 'node -v || true'
            }
        }
        stage('Docker Push to Nexus') {
            steps {
                echo 'Pushing Docker artifact to private Nexus repository...'
            }
        }
    }
    post {
        always {
            echo 'Pipeline execution completed.'
        }
        success {
            echo 'Build Succeeded!'
        }
        failure {
            echo 'Build Failed!'
        }
    }
}
```

---

## 7. Useful Docker Commands for Jenkins

```bash
# View live Jenkins startup logs
docker logs -f jenkins

# Enter inside Jenkins container shell
docker exec -it jenkins bash

# Stop & remove container without losing data (volume is preserved in ./jenkins_home)
docker compose down

# Restart Jenkins
docker compose restart
```
