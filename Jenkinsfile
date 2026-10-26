// BioGuard AI — Jenkins pipeline
//
// Runs the same Docker-based Playwright suite as the GitHub Actions workflow,
// publishes JUnit results to Jenkins and archives the quality reports.
//
// Agent requirements: Docker with the Compose plugin (docker compose v2).
// Jenkins plugins: Pipeline, Git, JUnit (all part of the suggested set).
// Optional: HTML Publisher, to view the reports as links on each build.

pipeline {
  agent any

  parameters {
    booleanParam(
      name: 'INJECT_DEMO_DEFECT',
      defaultValue: false,
      description: 'Deliberately break input validation to show test API-002 catching the defect (the build will fail).'
    )
  }

  // Daily build, some time between 6:00 and 6:59 in the Jenkins server's time zone.
  triggers {
    cron('H 6 * * *')
  }

  options {
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  environment {
    // A separate Compose project per build keeps containers and networks
    // from clashing with other jobs on the same agent.
    COMPOSE_PROJECT_NAME = "bioguard-jenkins-${env.BUILD_NUMBER}"
    INJECT_DEMO_DEFECT = "${params.INJECT_DEMO_DEFECT}"
  }

  stages {
    stage('Check tools') {
      steps {
        sh 'docker --version'
        sh 'docker compose version'
      }
    }

    stage('Build and run tests') {
      steps {
        sh 'docker compose build'
        sh 'docker compose up --abort-on-container-exit --exit-code-from qa'
      }
    }
  }

  post {
    always {
      // Containers write the reports as root; hand them back to the Jenkins
      // user so the workspace can be archived and cleaned up.
      sh 'docker compose run --rm --no-deps qa chown -R "$(id -u):$(id -g)" artifacts || true'

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

      sh 'docker compose down --volumes --remove-orphans || true'
    }
  }
}
