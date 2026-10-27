# BioGuard AI

[![Quality Pipeline](https://github.com/swethark105/BioGuard-AI/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/swethark105/BioGuard-AI/actions/workflows/quality.yml) [![Latest results](https://img.shields.io/badge/results-daily%20dashboard-blue)](https://swethark105.github.io/BioGuard-AI/)

**Synthetic Biotech Sample QA Automation & AI-Assisted Testing**

BioGuard AI is an independent QA engineering portfolio project demonstrating how to build an automated testing framework from scratch for a fictional biotech sample application.

It combines Playwright, TypeScript, API testing, requirements traceability, CI/CD, and AI-assisted test scenario review.

All sample data is fictional. The project is not a diagnostic tool or a validated regulatory quality system.

## Key Features

- **UI and API Automation:** Playwright with TypeScript.
- **Requirements Traceability:** Risk-based test coverage mapped to synthetic requirements.
- **AI-Assisted Testing:** Optional local AI-generated test scenario proposals.
- **Human-in-the-Loop Review:** Approve, request revisions, or reject AI proposals.
- **AI Failure Explanations:** Optional local AI suggests a likely cause for each failed test, clearly labelled as unverified.
- **CI/CD Integration:** Automated execution using GitHub Actions and Jenkins.
- **Quality Reporting:** HTML dashboards and Playwright reports.
- **Docker:** Reproducible test execution without installing Playwright or Node.js on the host.

## Test Execution Results

| Metric | Latest Verified Local Run |
|---|---|
| Total Tests | 14 |
| Passed | 14 |
| Failed | 0 |
| Requirements Covered | 7/7 |

Results reflect the local execution on October 27, 2026.

## Quick Start — Run with One Command

**Prerequisite:** Docker Desktop installed and running.

Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/swethark105/BioGuard-AI.git
cd BioGuard-AI
```

Execute the automated test suite:

```bash
docker compose up --build --abort-on-container-exit --exit-code-from qa
```

The command builds the environment, runs the automated tests, and generates quality reports. The first run requires internet access to download dependencies.

### Generated Reports

- `artifacts/quality-dashboard.html` — Test execution summary and requirements traceability.
- `artifacts/playwright-report/index.html` — Detailed Playwright HTML report.
- `artifacts/quality-summary.json` — Machine-readable test results.
- `artifacts/junit.xml` — JUnit test results, used by Jenkins.

## AI-Assisted Testing

BioGuard AI supports optional local AI-generated test scenario proposals using Ollama and `qwen2.5:1.5b`.

AI-generated proposals are not automatically added to the regression suite. They require human review and approval.

The core automation framework works without an AI model or paid AI services. Until you generate your own proposals, the review dashboard shows a built-in set of demo proposals.

### Generate AI Proposals (Optional)

Everything runs in Docker, so you don't need Node.js or Ollama installed on your machine.

1. Start the local Ollama service:

   ```bash
   docker compose --profile ai up -d ollama
   ```

2. Download the model (about 1 GB, first time only):

   ```bash
   docker compose exec ollama ollama pull qwen2.5:1.5b
   ```

3. Generate test scenario proposals:

   ```bash
   docker compose --profile ai run --rm --no-deps -e OLLAMA_URL=http://ollama:11434 qa node ai/suggest-tests.js
   ```

   Proposals are saved to `artifacts/ai-proposals.json` and replace the demo proposals in the dashboard. Generating a new set clears earlier review decisions. Small local models are not always reliable; if no usable proposals come back, run the command again.

4. Review them in the dashboard (see below). To go back to the demo proposals, delete `artifacts/ai-proposals.json`.

To stop Ollama afterwards: `docker compose --profile ai down`.

### AI Review Dashboard

The interactive dashboard demonstrates human-in-the-loop validation of AI-assisted test proposals. Reviewers can approve, request revisions, or reject scenarios with documented feedback.

![BioGuard AI Review Dashboard](docs/screenshots/ai-review-dashboard.png)

To explore the dashboard locally, start the sample application:

```bash
docker compose up -d --build app
```

Then visit:

`http://localhost:3000/ai-review`

Review decisions are saved to `artifacts/ai-reviews.json`. Running the test suite clears this file first, so every run starts from the same state.

### AI Failure Explanations (Optional)

When tests fail, a local AI model can suggest the likely cause of each failure. It reads the failed test's code, its error message and the linked requirement, and returns a short hypothesis plus one thing to check.

The suggestion is added to the quality dashboard under **Failed tests**, in a yellow box labelled **"AI suggestion — not verified"**. It never changes a test result: pass/fail is always decided by the test assertions, and an engineer must confirm the cause.

1. Run the tests (for example, the defect demonstration below) so there is at least one failure.
2. Make sure Ollama is running and the model is downloaded (steps 1 and 2 under *Generate AI Proposals*).
3. Ask the AI to explain the failures and rebuild the dashboard:

   ```bash
   docker compose --profile ai run --rm --no-deps -e OLLAMA_URL=http://ollama:11434 qa npm run explain
   ```

4. Open `artifacts/quality-dashboard.html`.

The explanation is saved to `artifacts/ai-failure-analysis.json` and is shown only for the test run it was written for. After a new test run, the dashboard hides the old explanation until you run `npm run explain` again. If every test passed, there is nothing to explain and no AI call is made.

The automated tests `AI-004` and `AI-005` use a fake AI server to check that notes are kept only for tests that really failed, are always marked unverified, and that unusable AI output is rejected without touching the test results.

## CI/CD Pipelines

The same Docker-based test suite runs in two CI/CD tools:

- **GitHub Actions** (`.github/workflows/quality.yml`) runs automatically on every push and pull request and uploads the quality reports.
- **Jenkins** (`Jenkinsfile`) runs the suite, shows pass/fail results and trends on each build, and archives the quality dashboard and Playwright report.

### Daily Runs and Published Results

GitHub Actions runs the full suite every day at 10:17 UTC (early morning in the US), as well as after every merge to `main`. Each of these runs publishes its results to GitHub Pages, including runs where tests fail:

- **Quality dashboard:** https://swethark105.github.io/BioGuard-AI/
- **Detailed Playwright report:** https://swethark105.github.io/BioGuard-AI/playwright-report/

To run it now, open the **Actions** tab, choose **BioGuard AI Quality Pipeline**, then **Run workflow**. The page always shows the latest run; earlier runs stay available as downloadable artifacts in the Actions tab.

One-time setup: in the repository **Settings → Pages**, set **Source** to **GitHub Actions**.

### Running in Jenkins

**Requirements:** a Jenkins agent with Docker and Docker Compose v2, plus the Pipeline, Git and JUnit plugins (included in Jenkins' suggested plugins). The HTML Publisher plugin is optional and adds direct links to the reports on each build.

1. In Jenkins, select **New Item**, enter a name such as `BioGuard-AI`, choose **Pipeline** and click **OK**.
2. Under **Pipeline**, set **Definition** to **Pipeline script from SCM**.
3. Choose **Git**, enter `https://github.com/swethark105/BioGuard-AI.git` and set the branch to `*/main`.
4. Leave **Script Path** as `Jenkinsfile` and click **Save**.
5. Click **Build Now**. After the first build, the button changes to **Build with Parameters**.

The Jenkinsfile also schedules a daily build between 6:00 and 6:59 in the Jenkins server's time zone.

To see the defect-detection demo in Jenkins, choose **Build with Parameters** and tick `INJECT_DEMO_DEFECT`. The build fails, and the test results show `API-002` catching the defect.

## Defect Detection Demonstration

The project includes an optional defect-injection feature that deliberately introduces a validation error.

For example, the API incorrectly accepts a negative fragment length. The automated test `API-002` detects this failure and links it to high-risk requirement `REQ-002`.

On Windows PowerShell:

```powershell
$env:INJECT_DEMO_DEFECT='true'
docker compose up --build --abort-on-container-exit --exit-code-from qa
Remove-Item Env:INJECT_DEMO_DEFECT
```

On macOS or Linux:

```bash
INJECT_DEMO_DEFECT=true docker compose up --build --abort-on-container-exit --exit-code-from qa
```

This demonstrates how automated testing identifies defects and connects them to requirements.

To see the AI suggest a cause for the failure, run `npm run explain` afterwards (see *AI Failure Explanations*).

## Project Structure

| Folder / File | Purpose |
|---|---|
| `app/` | Synthetic biotech sample application and APIs |
| `tests/api.spec.ts` | Automated API tests |
| `tests/ui.spec.ts` | Automated UI tests |
| `tests/ai-review.spec.ts` | AI review workflow tests |
| `tests/ai-failure-analysis.spec.ts` | AI failure explanation tests (fake AI server) |
| `tests/global-setup.ts` | Resets saved review decisions before each test run |
| `requirements/requirements.json` | Synthetic requirements and traceability |
| `ai/suggest-tests.js` | Optional local AI test proposals |
| `ai/explain-failures.js` | Optional local AI explanations for failed tests |
| `scripts/build-report.js` | Quality dashboard generation |
| `docs/ADLC.md` | AI-assisted development and QA lifecycle |
| `.github/workflows/quality.yml` | GitHub Actions CI/CD pipeline |
| `Jenkinsfile` | Jenkins CI/CD pipeline |

## Technology Stack

**Playwright | TypeScript | JavaScript | Node.js | Docker | GitHub Actions | Jenkins | Ollama (Optional)**

## Project Objective

BioGuard AI demonstrates a practical approach to designing a QA automation framework from scratch, combining deterministic testing, risk-based coverage, automated quality reporting, and responsible AI-assisted test design.

The project uses synthetic data and is intended for learning, demonstration, and portfolio purposes.

## License

Released under the [MIT License](LICENSE).
