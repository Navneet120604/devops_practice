# Complete Guide: Docker Private Registry with Sonatype Nexus (Push & Pull Setup)

This guide documents the complete end-to-end flow of setting up Sonatype Nexus 3 as a private Docker registry, creating custom blob stores, hosted repositories, security roles, users, configuring Docker daemon for insecure registry access, and executing docker login, tag, push, and pull commands.

---

## Architecture Overview

```
                                      +---------------------------------------------+
                                      |          Sonatype Nexus 3 Container         |
                                      |                                             |
[ Developer / CI/CD Machine ]         |   Port 8081 (or 8081) -> Nexus Web GUI      |
         |                            |                                             |
         +--- docker login :8083 ---> |   Port 8083 ----------> Docker Hosted Repo  |
         +--- docker push  :8083 ---> |                         (my-store Blob)     |
         +--- docker pull  :8083 ---> |                                             |
                                      +---------------------------------------------+
```

---

## 1. Running Sonatype Nexus via Docker

Run the Nexus container with persistent data volume and dedicated ports for Web UI and Docker connectors:

```bash
docker run -d \
  --name nexus \
  -p 8081:8081 \
  -p 8083:8083 \
  -p 8084:8084 \
  -v nexus-data:/nexus-data \
  --restart always \
  sonatype/nexus3:latest
```

* **8081:8081**: Nexus Web Management UI.
* **8083:8083**: Docker Hosted Repository HTTP connector.
* **8084:8084**: Reserved for Docker Group or Proxy connector.
* **nexus-data**: Persistent Docker named volume storing databases and repositories.

### Retrieve Initial Admin Password
Nexus takes ~1-2 minutes to initialize. Retrieve the temporary password:

```bash
docker exec -it nexus cat /nexus-data/admin.password
```

Open browser at `http://localhost:8081`, login as `admin`, and set a new password (e.g. `Navneet@123`).

---

## 2. Nexus Security: Enable Docker Bearer Token Realm

Docker client authentication requires the **Docker Bearer Token Realm**.

1. Go to **⚙️ Administration (Gear Icon)** -> **Security** -> **Realms**.
2. Locate **Docker Bearer Token Realm** in the **Available** list.
3. Move it to the **Active** list on the right.
4. Click **Save**.

---

## 3. Storage Setup: Create Blob Store

1. Go to **⚙️ Administration** -> **Repository** -> **Blob Stores**.
2. Click **Create blob store**.
3. Type: `File`.
4. Name: `my-store`.
5. Path: will auto-populate as `my-store`.
6. Click **Save**.

---

## 4. Repository Setup: Create Docker Hosted Repository

1. Go to **⚙️ Administration** -> **Repository** -> **Repositories**.
2. Click **Create repository** and select **`docker (hosted)`**.
3. Configure the repository:
   * **Name**: `docker-hosted`
   * **HTTP Connector**: Check **HTTP** and set Port to `8083`.
   * **Enable Docker V1 API**: Check this box (supports various docker client formats).
   * **Blob store**: Select `my-store`.
   * **Deployment policy**: `Allow redeploy` (or `Disable redeploy` for strict prod).
4. Click **Create repository**.

---

## 5. Security & Access Control: Roles and Users

To follow the principle of least privilege, create a dedicated user for Docker operations instead of using root `admin`.

### Step 5.1: Create Docker Role
1. Go to **⚙️ Administration** -> **Security** -> **Roles**.
2. Click **Create role** -> **Nexus role**.
3. Role ID: `docker-read-write`
4. Role Name: `Docker Read and Write Access`
5. In **Privileges**, filter by `docker` and assign:
   * `nx-repository-view-docker-*-*` (or specific to `docker-hosted`)
6. Click **Save**.

*(For read-only access, create role `docker-read-only` and assign only `nx-repository-view-docker-*-read` & `nx-repository-view-docker-*-browse`).*

### Step 5.2: Create User
1. Go to **⚙️ Administration** -> **Security** -> **Users**.
2. Click **Create local user**.
3. ID: `nothing` (or your preferred username)
4. First Name: `DevOps`
5. Last Name: `Engineer`
6. Email: `devops@example.com`
7. Password: Set user password (e.g., `Navneet@123`)
8. Status: `Active`
9. Roles: Assign `docker-read-write` (and default `nx-anonymous` or `nx-authorized`).
10. Click **Save**.

---

## 6. Host Machine: Configure Insecure Registry in Docker Daemon

Because the local registry connector runs on HTTP (`8083`) without an SSL certificate, the Docker daemon must allow it as an insecure registry.

### For Snap-based Docker (Ubuntu Canonical Snap):
```bash
sudo mkdir -p /var/snap/docker/current/config
echo '{"insecure-registries": ["localhost:8083", "127.0.0.1:8083"]}' | sudo tee /var/snap/docker/current/config/daemon.json
sudo snap restart docker
```

### For Standard Apt-based Docker:
```bash
sudo mkdir -p /etc/docker
echo '{"insecure-registries": ["localhost:8083", "127.0.0.1:8083"]}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

### Verify Configuration:
```bash
docker info | grep -i "insecure" -A 2
```
Expected output:
```text
 Insecure Registries:
  127.0.0.1:8083
  localhost:8083
```

---

## 7. Execution: Login, Tag, Push, and Pull

### 1. Docker Login to Nexus Registry
```bash
docker login localhost:8083
```
* Prompt **Username**: `nothing`
* Prompt **Password**: `Navneet@123`
* Output: `Login Succeeded`

### 2. Build or Identify Local Image
```bash
docker images
```

### 3. Tag Image for Nexus
The image name must be prefixed with the registry host and port:
```bash
docker tag docvol:1.0 localhost:8083/docvol:1.0
```

### 4. Push Image to Nexus Repository
```bash
docker push localhost:8083/docvol:1.0
```
Output will display all layers streaming and finalizing with a SHA256 digest:
```text
The push refers to repository [localhost:8083/docvol]
f18232174bc9: Pushed
...
1.0: digest: sha256:e92f65f7b368a18c323cf570d9b2079fc677d0ad742f3be05620620b2d57dbca size: 856
```

### 5. Verify Artifact in Nexus REST API / GUI
Query Nexus REST API:
```bash
curl -u nothing:Navneet@123 -X GET 'http://localhost:8081/service/rest/v1/components?repository=docker-hosted'
```
Or check the Web UI: **Browse (📦)** -> **docker-hosted** -> **docvol** -> **1.0**.

### 6. Delete Local Image & Pull from Nexus
To verify that the image can be pulled back independently from Nexus:
```bash
# Remove local references
docker rmi localhost:8083/docvol:1.0

# Pull fresh from Nexus
docker pull localhost:8083/docvol:1.0
```
Output:
```text
1.0: Pulling from docvol
Digest: sha256:e92f65f7b368a18c323cf570d9b2079fc677d0ad742f3be05620620b2d57dbca
Status: Downloaded newer image for localhost:8083/docvol:1.0
localhost:8083/docvol:1.0
```

---

## 8. Troubleshooting Quick Reference

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| `http: server gave HTTP response to HTTPS client` | Docker daemon enforces HTTPS | Add `insecure-registries` to `daemon.json` and restart Docker. |
| `unauthorized: access to the requested resource is not authorized` | Bearer Token Realm disabled or insufficient role | Enable `Docker Bearer Token Realm` in Realms and verify user role permissions. |
| `connection refused` on port 8083 | Connector port not mapped in container | Ensure `-p 8083:8083` is passed during `docker run` or in `docker-compose.yaml`. |
| Login credentials warning in CLI | Docker config unencrypted warning | Normal default behavior unless `pass` / `secretservice` helper is configured. |
