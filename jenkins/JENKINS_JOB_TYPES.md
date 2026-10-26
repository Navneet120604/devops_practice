# Jenkins Job Types Master Reference Guide

In Jenkins, when you click **"New Item"**, you are presented with various job and container types. Selecting the wrong job type for a workload leads to high maintenance overhead, unversioned CI/CD code, and scalability bottlenecks.

This guide provides an industry-grade breakdown of all Jenkins item types visible on the **New Item** dashboard:
1. [Pipeline](#1-pipeline)
2. [Freestyle Project](#2-freestyle-project)
3. [Multi-configuration Project (Matrix Project)](#3-multi-configuration-project-matrix-project)
4. [Multibranch Pipeline](#4-multibranch-pipeline)
5. [Folder](#5-folder)
6. [Organization Folder (GitHub / Bitbucket Org)](#6-organization-folder)
7. [Comparative Decision Matrix](#7-comparative-decision-matrix)

---

## 1. Pipeline

### What it is:
A Pipeline is the modern, industry-standard way to model complex delivery processes using **Pipeline-as-Code** via a [`Jenkinsfile`](file:///home/nav/devops_practice/jenkins/Jenkinsfile). It can be written in two syntaxes:
* **Declarative Pipeline** (clean, structured, opinionated, easy to read).
* **Scripted Pipeline** (Groovy-based, completely flexible for complex programming logic).

### Real-World Use Cases:
* **End-to-End Enterprise CI/CD**: Checkout -> Static Code Analysis (SonarQube) -> Unit Tests -> Docker Build -> Nexus/Docker Hub Push -> Kubernetes / ArgoCD Deploy.
* **Multi-stage & Multi-node Workflows**: Running tests across multiple parallel agents (e.g., Linux, Windows, macOS).
* **Automated Rollback & Canary / Blue-Green Deployments**: Scripted health checks determining whether to promote or roll back releases.

### Where NOT to use & Why:
* **Quick, one-off diagnostic tasks**: If you simply need to restart a remote service or run a 2-line bash cleanup script, writing a full Jenkinsfile pipeline is unnecessary overhead.
* **Teams with zero programming / Git knowledge**: Requires understanding basic syntax and version control.

### Advantages:
* **Pipeline-as-Code**: The CI/CD logic lives in Git with the application code. It is peer-reviewed, versioned, and auditable.
* **Resilience**: Survives Jenkins controller restarts (can resume mid-stage).
* **Parallel Execution**: Native support for running parallel stages across multiple agents.
* **Human-in-the-Loop Approvals**: Built-in `input` step for production release approvals.

### Disadvantages:
* Steeper learning curve compared to GUI-based forms.
* Debugging Groovy syntax errors can take more iterations.

---

## 2. Freestyle Project

### What it is:
The classic, original Jenkins job type configured entirely through a web form GUI. It runs tasks sequentially: SCM Checkout -> Build Steps -> Post-build Actions.

### Real-World Use Cases:
* **Simple Script Execution & Cron Triggers**: Running scheduled backup scripts, database maintenance, or log rotation.
* **Simple Single-step Builds**: Building a quick demo jar or running a single `mvn clean package` or `docker build` without complex branching.
* **DevOps Learning / Quick Proof-of-Concepts (PoCs)**: Ideal for beginners learning how SCM triggers and shell execution work in Jenkins.

### Where NOT to use & Why:
* **Never use for Production Microservices & Enterprise CI/CD**:
  * Configurations are stored in XML files on the Jenkins controller disk, not in Git.
  * If someone alters a form field or deletes a build step, there is no Git diff or commit history to revert.
  * No native stage visualization or parallel pipeline flow.

### Advantages:
* Very simple, point-and-click setup with zero code needed.
* Extensive plugin support with direct UI fields.
* Great for rapid prototyping.

### Disadvantages:
* **No Version Control**: Job changes are not tracked in Git.
* **No Pipeline Stages**: Fails to show visual stages like Checkout, Test, and Deploy on the UI dashboard.
* **Hard to Replicate**: If Jenkins crashes, reconstructing 50 freestyle jobs by hand is painful.

---

## 3. Multi-configuration Project (Matrix Project)

### What it is:
Also known as a **Matrix Job**, this project type allows you to define multiple parameters or axes (e.g., Operating Systems, Python/Java versions, Browsers) and automatically generates a matrix of combinations to run across distributed agents.

### Real-World Use Cases:
* **Cross-Platform Software Compilation**: Compiling C++ or Go binaries across `Ubuntu 22.04`, `Debian 12`, `CentOS 9`, and `Windows Server`.
* **SDK / Library Compatibility Testing**: Verifying an open-source library works against Python `3.9`, `3.10`, `3.11`, `3.12` and Node.js `18`, `20`, `22`.
* **Cross-Browser Automated Testing**: Running Selenium tests against Chrome, Firefox, Safari, and Edge.

### Where NOT to use & Why:
* **Standard Web Applications / Microservices**: A microservice packaged into a standard Linux container does not need matrix testing; building it on 4 different OSs is a waste of compute resources.
* **Modern Pipelines**: Modern Jenkins declarative pipelines can achieve the same matrix capability using the `matrix { ... }` directive in code, making standalone Matrix projects mostly legacy.

### Advantages:
* Generates multiple build permutations from a single configuration.
* Clear grid UI displaying which platform or version combination failed.

### Disadvantages:
* Heavy resource consumption (spawns dozens of build agents simultaneously).
* Legacy project model (superseded by Declarative Pipeline's `matrix` block).

---

## 4. Multibranch Pipeline

### What it is:
A specialized Pipeline job that scans your entire Git repository, automatically discovers branches and pull requests containing a `Jenkinsfile`, and dynamically creates and deletes sub-pipelines for them.

### Real-World Use Cases:
* **Feature-Branch CI Workflows (GitFlow / GitHub Flow)**: When a developer creates branch `feature/auth-login`, Jenkins detects it, creates a job, and runs automated tests immediately.
* **Pull Request (PR) Validation**: Automatically building and testing PRs before they are merged into `main`, reporting build status directly to GitHub/GitLab PR checks.
* **Automatic Cleanup**: When a branch is merged and deleted from Git, Jenkins automatically archives and removes the corresponding sub-job.

### Where NOT to use & Why:
* **Static, single-branch projects**: If a project never uses branches or PRs (e.g. an isolated maintenance repo).
* **Repositories without a `Jenkinsfile`**: Multibranch requires a `Jenkinsfile` inside the repo; without it, scanning will discover zero jobs.

### Advantages:
* **Zero Manual Job Creation**: Developers just push a branch; Jenkins handles the rest.
* **PR Gating**: Prevents broken code from merging to master/main branches.
* **Isolated Workspaces**: Each branch has its own independent workspace and build history.

### Disadvantages:
* SCM polling or webhook configuration is required on the Git provider to trigger instant branch scans.
* Heavy repository scanning if not filtered by branch regex.

---

## 5. Folder

### What it is:
Not a runnable build job itself, but a organizational namespace and container to group related projects, pipelines, and subfolders together.

### Real-World Use Cases:
* **Multi-Tenant / Multi-Team Segregation**: Organizing jobs by department or team (e.g., `/Frontend-Team`, `/Payments-Team`, `/Infrastructure-Team`).
* **Environment Segregation**: Organizing by environment (e.g., `/Production-Deployments`, `/Staging-Deployments`).
* **Role-Based Access Control (RBAC)**: Granting team members access only to their specific folder while restricting access to other teams' projects.
* **Scoped Credentials**: Storing production AWS/Docker credentials inside a `/Production` folder so non-production jobs cannot access them.

### Where NOT to use & Why:
* When you only have 2 or 3 total jobs in Jenkins (adds unnecessary navigation clicks).

### Advantages:
* Clean, organized UI dashboard.
* Security containment: Scopes permissions, views, and credentials to a folder.

### Disadvantages:
* Purely organizational; performs no build or automation actions on its own.

---

## 6. Organization Folder

### What it is:
The top-tier enterprise automation container. It scans an entire **GitHub Organization** or **GitLab / Bitbucket Group**, discovers all repositories containing a `Jenkinsfile`, and sets up Multibranch Pipelines for every repository automatically.

### Real-World Use Cases:
* **Enterprise-Scale Centralized DevOps**: When a company has 100+ microservice repositories in a GitHub Organization. When any developer creates a new repo with a `Jenkinsfile`, Jenkins onboard it with zero manual intervention.
* **Microservices Ecosystem**: Standardizing CI/CD across dozens of microservices with uniform repository structure.

### Where NOT to use & Why:
* **Single Repository Projects**: Unnecessary complexity if you only have 1 or 2 repos.
* **Public GitHub Orgs with unknown repos**: Can hit GitHub API rate limits rapidly without fine-tuned filtering.

### Advantages:
* **Ultimate Zero-Touch Onboarding**: No one ever needs to open Jenkins UI to create jobs for new services.
* Automatically discovers, builds, and manages hundreds of microservice repositories.

### Disadvantages:
* Requires high-privilege GitHub/GitLab organization access tokens.
* API rate limiting if branch indexing is not configured carefully.

---

## 7. Comparative Decision Matrix

| Item Type | Code Stored In Git? | Best For | Production Recommended? | Key Trade-off |
| :--- | :---: | :--- | :---: | :--- |
| **Pipeline** | Yes (`Jenkinsfile`) | End-to-end CI/CD for a single repo | **Yes (Standard)** | Requires learning Groovy/Pipeline syntax |
| **Multibranch Pipeline** | Yes (`Jenkinsfile`) | GitFlow, PR checks, feature branches | **Yes (Best Practice)** | Needs webhooks/branch filtering |
| **Freestyle Project** | No (XML on Master) | Simple scripts, cron jobs, beginner PoCs | **No (Legacy for apps)** | No Git versioning; manual click ops |
| **Matrix Project** | Optional | Cross-platform SDK / OS compatibility | Limited to SDKs | High agent resource consumption |
| **Folder** | N/A | RBAC security & grouping jobs by team | **Yes (Organization)** | Organizational container only |
| **Organization Folder** | Yes (`Jenkinsfile`) | Entire GitHub / GitLab Org with 100+ repos | **Yes (Large Scale)** | API rate limits, complex initial setup |

---

## Summary Recommendation: What Should You Use?

* **Learning / One-off scripts:** Start with **Freestyle Project** to understand tools and shell concepts.
* **Single Project Production Deployment:** Use **Pipeline** with a `Jenkinsfile`.
* **Professional Team Workflow (PRs + Feature branches):** Use **Multibranch Pipeline**.
* **Enterprise Multi-team Organization:** Group everything inside **Folders** with RBAC!
