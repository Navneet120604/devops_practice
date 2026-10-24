# Jenkins Complete CI/CD Guide & Freestyle Project Master Documentation

Welcome to the comprehensive Jenkins DevOps guide. This repository contains the complete blueprint for running Jenkins on Docker, configuring Docker socket access (Docker-in-Docker), setting up GitHub Repository authentication, creating production-grade Freestyle and Pipeline jobs, and building Docker images within CI/CD.

---

## 📑 Table of Contents
1. [Architecture & How Jenkins Talks to Docker](#1-architecture--how-jenkins-talks-to-docker)
2. [Jenkins Container Installation (Terminal Steps)](#2-jenkins-container-installation-terminal-steps)
3. [Connecting Jenkins with Docker Engine (Crucial Setup)](#3-connecting-jenkins-with-docker-engine-crucial-setup)
4. [Initial Jenkins Unlock & Credentials Setup](#4-initial-jenkins-unlock--credentials-setup)
5. [Connecting GitHub Repository to Jenkins](#5-connecting-github-repository-to-jenkins)
6. [Step-by-Step: Creating a Freestyle Job to Build Docker Images](#6-step-by-step-creating-a-freestyle-job-to-build-docker-images)
7. [Troubleshooting & Common Real-world Errors](#7-troubleshooting--common-real-world-errors)
8. [Next Level: CI/CD Pipeline (`Jenkinsfile`) Reference](#8-next-level-cicd-pipeline-jenkinsfile-reference)

---

## 1. Architecture & How Jenkins Talks to Docker

```
+---------------------------------------------------------------------------------------+
|                                    HOST MACHINE                                       |
|                                                                                       |
|   +--------------------------+                      +-----------------------------+   |
|   |    Docker Engine Daemon  |                      |      Jenkins Container      |   |
|   |     (/var/run/docker.sock|<====================>|  /var/run/docker.sock       |   |
|   +--------------------------+  Mounted into        |  docker CLI client installed|   |
|                                 Jenkins container   |  Workspace: /var/jenkins_...|   |
|                                                     +-----------------------------+   |
|                                                                    |                  |
|                                                                    v                  |
|                                                           GitHub Repository           |
|                                                  (https://github.com/.../repo.git)    |
+---------------------------------------------------------------------------------------+
```

When Jenkins builds Docker images inside the container, it **does not run another Docker daemon**. Instead, it uses the host's `/var/run/docker.sock` to instruct the host Docker daemon to build, tag, and push images!

---

## 2. Jenkins Container Installation (Terminal Steps)

### Step 2.1: Prepare Jenkins Workspace & Directory
Navigate to your practice folder and ensure a clean environment:

```bash
cd /home/nav/devops_practice/jenkins
mkdir -p jenkins_home
```

### Step 2.2: Launch Container with Docker-in-Docker Socket Mount
Run Jenkins with port `8088` (to avoid collision with default `8080`), mounted Docker socket, and root execution privileges:

```bash
docker run -d \
  --name jenkins \
  -p 8088:8080 \
  -p 50000:50000 \
  -u root \
  -v $(pwd)/jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --restart unless-stopped \
  jenkins/jenkins:lts
```

* `-p 8088:8080`: Maps host port `8088` to Jenkins Web UI `8080`.
* `-p 50000:50000`: Inbound agent communication port.
* `-u root`: Runs container as root so it has permissions over mounted sockets and volumes.
* `-v $(pwd)/jenkins_home:/var/jenkins_home`: Preserves jobs, build history, plugins, and credentials across restarts.
* `-v /var/run/docker.sock:/var/run/docker.sock`: Allows Jenkins to execute `docker` commands on the host daemon.

---

## 3. Connecting Jenkins with Docker Engine (Crucial Setup)

The standard `jenkins/jenkins:lts` image does not come with the `docker` CLI binary preinstalled. You must install the CLI inside the container once:

```bash
# 1. Install Docker CLI inside Jenkins container
docker exec -it jenkins apt-get update
docker exec -it jenkins apt-get install -y docker.io

# 2. Grant permissions to docker socket on host
sudo chmod 666 /var/run/docker.sock

# 3. Verify Docker access from inside Jenkins
docker exec -it jenkins docker --version
docker exec -it jenkins docker ps
```

If `docker ps` outputs the list of running containers, **Jenkins is successfully connected to the host Docker daemon!**

---

## 4. Initial Jenkins Unlock & Credentials Setup

1. Open your browser and go to:
   ```text
   http://localhost:8088
   ```
2. You will see the **"Unlock Jenkins"** screen.
3. Retrieve the initial administrator password from the container:
   ```bash
   docker exec -it jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
4. Copy and paste the password into the browser.
5. Click **"Install suggested plugins"** (installs Git, Pipeline, Credentials, SSH Agent, Workspace plugins).
6. Create your Admin user (e.g., `admin` / `YourSecurePassword`).
7. Save and Finish -> Click **Start using Jenkins**.

---

## 5. Connecting GitHub Repository to Jenkins

### Step 5.1: Create GitHub Personal Access Token (PAT)
1. On GitHub, go to **Settings** -> **Developer Settings** -> **Personal access tokens** -> **Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Note: `Jenkins-CI-Token`.
4. Expiration: 90 days or No expiration (for testing).
5. Scopes to check:
   * `repo` (Full control of private repositories)
   * `admin:repo_hook` (For auto-triggering webhooks)
6. Click **Generate token** and copy the token value (e.g., `ghp_xxxxxxxxxxxx`).

### Step 5.2: Add Credentials in Jenkins
1. In Jenkins dashboard, go to **Manage Jenkins** -> **Credentials** -> **System** -> **Global credentials (unrestricted)**.
2. Click **+ Add Credentials**.
3. Kind: **Username with password** (or *SSH Username with private key* if using SSH).
4. Username: Your GitHub username (e.g. `Navneet120604`).
5. Password: Your GitHub Personal Access Token (`ghp_...`).
6. ID: `github-con`
7. Description: `GitHub Access Token`
8. Click **Create**.

---

## 6. Step-by-Step: Creating a Freestyle Job to Build Docker Images

### Step 6.1: Create Job
1. From Jenkins Home, click **New Item**.
2. Enter item name: `my-job` (or `docker-volume-build`).
3. Select **Freestyle project**.
4. Click **OK**.

### Step 6.2: Configure Source Code Management (Git)
In the job configuration page:
1. Select **Git**.
2. **Repository URL**: 
   * ✅ **CORRECT:** `https://github.com/Navneet120604/devops_practice.git`
   * ❌ **DO NOT USE:** `https://github.com/Navneet120604/devops_practice/tree/main/...` (Tree URLs will fail).
3. **Credentials**: Select `github-con`.
4. **Branches to build**:
   * Change `*/master` to `*/main` (since GitHub default is `main`).

### Step 6.3: Configure Build Triggers (Optional)
* To trigger build automatically on git push, check **GitHub hook trigger for GITScm polling** or **Poll SCM** (`H/5 * * * *` for every 5 mins).

### Step 6.4: Add Build Step (Execute Shell)
1. Scroll down to **Build Steps**.
2. Click **Add build step** -> **Execute shell**.
3. In the **Command** text area, paste this production script:

```bash
#!/bin/bash
set -e

echo "=========================================="
echo " BUILD ID: ${BUILD_NUMBER}"
echo " WORKSPACE: ${WORKSPACE}"
echo " USER: $(whoami)"
echo "=========================================="

# 1. Navigate to target project directory
cd docker_volume

# 2. Build Docker Image
echo "=== Step 1: Building Docker Image ==="
docker build -t docvol:${BUILD_NUMBER} -t docvol:latest .

# 3. Verify Local Build
echo "=== Step 2: Verifying Generated Docker Image ==="
docker images | grep docvol

# 4. Optional: Push to Local Sonatype Nexus Registry (if running)
if docker ps | grep -q nexus; then
    echo "=== Step 3: Tagging and Pushing to Nexus Registry ==="
    docker tag docvol:${BUILD_NUMBER} localhost:8083/docvol:${BUILD_NUMBER}
    docker push localhost:8083/docvol:${BUILD_NUMBER}
    echo "Image successfully pushed to Nexus Registry!"
else
    echo "Nexus not running, skipping registry push."
fi

echo "=========================================="
echo " BUILD SUCCESSFUL!"
echo "=========================================="
```

4. Click **Apply** and **Save**.

### Step 6.5: Run Build & Check Console Output
1. Click **Build Now** in the left sidebar.
2. In the **Build History** table, click on the flashing circle (e.g., `#1` or `#2`).
3. Click **Console Output**.
4. You will see:
   - Git cloning `devops_practice.git`.
   - Node Alpine base image downloading.
   - `npm install` executing.
   - Image building and tagging `docvol:latest`.
   - Final status: **`Finished: SUCCESS`** (Blue/Green orb)!

---

## 7. Troubleshooting & Common Real-world Errors

| Error Log | Root Cause | Solution |
| :--- | :--- | :--- |
| `failed to bind host port 0.0.0.0:8080/tcp: address already in use` | Host port 8080 already taken by another process | Run Jenkins on port `8088:8080` or kill the process on port 8080 (`kill -9 $(lsof -t -i:8080)`). |
| `docker: command not found` | Docker CLI binary not inside Jenkins container | Run `docker exec -u 0 -it jenkins apt-get update && docker exec -u 0 -it jenkins apt-get install -y docker.io`. |
| `Cannot connect to the Docker daemon at unix:///var/run/docker.sock` | Docker socket not mounted or permission denied | Mount `-v /var/run/docker.sock:/var/run/docker.sock` and run `sudo chmod 666 /var/run/docker.sock` on host. |
| `fatal: repository '.../tree/main/...' not found` | Subdirectory web page URL pasted instead of git clone URL | Use the clean repository URL ending with `.git`: `https://github.com/<user>/<repo>.git`. |
| `fatal: not in a git directory (status code 128)` | Corrupted `.git` state from an interrupted previous build | Run `docker exec -it jenkins rm -rf /var/jenkins_home/workspace/my-job` or click **Wipe out workspace** in Jenkins UI. |
| `Host key verification failed` | Missing SSH known_hosts entry for github.com | In Jenkins, go to **Manage Jenkins** -> **Security** -> **Git Host Key Verification Configuration** and select **Accept first connection** or use HTTPS with PAT. |

---

## 8. Next Level: CI/CD Pipeline (`Jenkinsfile`) Reference

When transitioning from Freestyle projects to industry-standard Pipeline-as-Code, place this [`Jenkinsfile`](file:///home/nav/devops_practice/jenkins/Jenkinsfile) at the root of your repo:

```groovy
pipeline {
    agent any

    environment {
        REGISTRY = 'localhost:8083'
        APP_NAME = 'docvol'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('docker_volume') {
                    sh "docker build -t ${APP_NAME}:${BUILD_NUMBER} -t ${APP_NAME}:latest ."
                }
            }
        }

        stage('Publish Artifact to Nexus') {
            steps {
                sh """
                    docker tag ${APP_NAME}:${BUILD_NUMBER} ${REGISTRY}/${APP_NAME}:${BUILD_NUMBER}
                    docker push ${REGISTRY}/${APP_NAME}:${BUILD_NUMBER} || true
                """
            }
        }
    }

    post {
        success {
            echo "Pipeline Completed Successfully! Build #${BUILD_NUMBER}"
        }
        failure {
            echo "Build Failed. Please check console output."
        }
    }
}
```

---

## 9. Quick Command Reference

```bash
# View live Jenkins container logs
docker logs -f jenkins

# Enter inside container as root
docker exec -it -u 0 jenkins bash

# Check Jenkins home disk usage
du -sh /home/nav/devops_practice/jenkins/jenkins_home

# Reset workspace for a specific job
docker exec -it jenkins rm -rf /var/jenkins_home/workspace/my-job
```
