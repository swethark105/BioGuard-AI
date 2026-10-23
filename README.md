# BioGuard AI

**Synthetic Biotech Sample QA Automation & AI-Assisted Testing**

BioGuard AI is an independent QA engineering portfolio project demonstrating how to build an automated testing framework from scratch for a fictional biotech sample application.

It combines Playwright, TypeScript, API testing, requirements traceability, CI/CD, and AI-assisted test scenario review.

All sample data is fictional. The project is not a diagnostic tool or a validated regulatory quality system.

## Key Features

- **UI and API Automation:** Playwright with TypeScript.
- **Requirements Traceability:** Risk-based test coverage mapped to synthetic requirements.
- **AI-Assisted Testing:** Optional local AI-generated test scenario proposals.
- **Human-in-the-Loop Review:** Approve, request revisions, or reject AI proposals.
- **CI/CD Integration:** Automated execution using GitHub Actions.
- **Quality Reporting:** HTML dashboards and Playwright reports.
- **Docker:** Reproducible test execution without installing Playwright or Node.js on the host.

## Test Execution Results

| Metric | Latest Verified Local Run |
|---|---|
| Total Tests | 12 |
| Passed | 12 |
| Failed | 0 |
| Requirements Covered | 5/5 |

Results reflect the local execution on October 22, 2026.

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

## AI-Assisted Testing

BioGuard AI supports optional local AI-generated test scenario proposals using Ollama and `qwen2.5:1.5b`.

AI-generated proposals are not automatically added to the regression suite. They require human review and approval.

The core automation framework works without an AI model or paid AI services.

### AI Review Dashboard

The interactive dashboard demonstrates human-in-the-loop validation of AI-assisted test proposals. Reviewers can approve, request revisions, or reject scenarios with documented feedback.

![BioGuard AI Review Dashboard](docs/screenshots/ai-review-dashboard.png)

To explore the dashboard locally, start the sample application:

```bash
docker compose up -d --build app
```

Then visit:

`http://localhost:3000/ai-review`

## Defect Detection Demonstration

The project includes an optional defect-injection feature that deliberately introduces a validation error.

For example, the API incorrectly accepts a negative fragment length. The automated test `API-002` detects this failure and links it to high-risk requirement `REQ-002`.

On Windows PowerShell:

```powershell
$env:INJECT_DEMO_DEFECT='true'
docker compose up --build --abort-on-container-exit --exit-code-from qa
Remove-Item Env:INJECT_DEMO_DEFECT
```

This demonstrates how automated testing identifies defects and connects them to requirements.

## Project Structure

| Folder / File | Purpose |
|---|---|
| `app/` | Synthetic biotech sample application and APIs |
| `tests/api.spec.ts` | Automated API tests |
| `tests/ui.spec.ts` | Automated UI tests |
| `tests/ai-review.spec.ts` | AI review workflow tests |
| `requirements/requirements.json` | Synthetic requirements and traceability |
| `ai/suggest-tests.js` | Optional local AI test proposals |
| `scripts/build-report.js` | Quality dashboard generation |
| `docs/ADLC.md` | AI-assisted development and QA lifecycle |
| `.github/workflows/quality.yml` | CI/CD automation |

## Technology Stack

**Playwright | TypeScript | JavaScript | Node.js | Docker | GitHub Actions | Ollama (Optional)**

## Project Objective

BioGuard AI demonstrates a practical approach to designing a QA automation framework from scratch, combining deterministic testing, risk-based coverage, automated quality reporting, and responsible AI-assisted test design.

The project uses synthetic data and is intended for learning, demonstration, and portfolio purposes.
