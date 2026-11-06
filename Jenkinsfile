// BioGuard AI — Jenkins pipeline
//
// Runs the same Docker-based Playwright suite as the GitHub Actions workflow,
// publishes JUnit results to Jenkins and archives the quality reports.
//
// Agent requirements: Docker with the Compose plugin (docker compose v2).
// Works on Linux, macOS and Windows agents (Windows uses bat instead of sh).
// Jenkins plugins: Pipeline, Git, JUnit (all part of the suggested set).
// Optional: HTML Publisher, to view the reports as links on each build.
//
// Works as a Pipeline job or a Multibranch Pipeline. In a Multibranch Pipeline
// every branch is built when it changes, but only main runs on the daily schedule.

// runCmd: runs a shell command with sh on Linux/macOS and with bat on Windows.
def runCmd(String command) {
  if (isUnix()) {
    sh command
  } else {
    bat command
  }
}

pipeline {
  agent any

  parameters {
    booleanParam(
      name: 'INJECT_DEMO_DEFECT',
      defaultValue: false,
      description: 'Deliberately break input validation to show test API-002 catching the defect (the build will fail).'
    )
  }

  // Daily build of main, some time between 6:00 and 6:59 in the Jenkins
  // server's time zone. Other branches (Multibranch Pipeline) get no schedule.
  triggers {
    cron(env.BRANCH_NAME == null || env.BRANCH_NAME == 'main' ? 'H 6 * * *' : '')
  }

  options {
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  environment {
    INJECT_DEMO_DEFECT = "${params.INJECT_DEMO_DEFECT}"
  }

  stages {
    stage('Check tools') {
      steps {
        script {
          // A separate Compose project per branch and build keeps containers and
          // networks from clashing with other builds on the same agent.
          def branch = env.BRANCH_NAME ?: 'main'
          env.COMPOSE_PROJECT_NAME = "bioguard-${branch}-${env.BUILD_NUMBER}".toLowerCase().replaceAll('[^a-z0-9_-]', '-')
        }
        runCmd 'docker --version'
        runCmd 'docker compose version'
      }
    }

    stage('Build and run tests') {
      steps {
        runCmd 'docker compose build'
        runCmd 'docker compose up --abort-on-container-exit --exit-code-from qa'
      }
    }
  }

  post {
    always {
      // On Linux, containers write the reports as root; hand them back to the
      // Jenkins user so the workspace can be archived and cleaned up.
      // Docker Desktop on Windows and macOS doesn't need this.
      script {
        if (isUnix()) {
          sh 'docker compose run --rm --no-deps qa chown -R "$(id -u):$(id -g)" artifacts || true'
        }
      }

      junit testResults: 'artifacts/junit.xml', allowEmptyResults: true

      archiveArtifacts(
        artifacts: 'artifacts/quality-dashboard.html, artifacts/quality-summary.json, artifacts/results.json, artifacts/junit.xml, artifacts/playwright-report/**',
        allowEmptyArchive: true,
        fingerprint: true
      )

      script {
        try {
          publishHTML(target: [
            reportName: 'Quality Dashboard',
            reportDir: 'artifacts',
            reportFiles: 'quality-dashboard.html',
            keepAll: true,
            alwaysLinkToLastBuild: true,
            allowMissing: true
          ])
          publishHTML(target: [
            reportName: 'Playwright Report',
            reportDir: 'artifacts/playwright-report',
            reportFiles: 'index.html',
            keepAll: true,
            alwaysLinkToLastBuild: true,
            allowMissing: true
          ])
        } catch (NoSuchMethodError ignored) {
          echo 'HTML Publisher plugin not installed; reports are still available under Build Artifacts.'
        }
      }

      script {
        if (isUnix()) {
          sh 'docker compose down --volumes --remove-orphans || true'
        } else {
          bat 'docker compose down --volumes --remove-orphans || exit /b 0'
        }
      }
    }
  }
}
