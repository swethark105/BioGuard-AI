# Playwright Test Agents (VS Code + GitHub Copilot)

BioGuard AI includes Playwright's three test agents, set up for **GitHub Copilot in VS Code**:

| Agent | What it does | Output |
|---|---|---|
| **Planner** | Opens the running app in a browser, explores it and writes a test plan | Markdown plan in `specs/` |
| **Generator** | Turns one scenario from a plan into a Playwright test, checking each step live | `.spec.ts` file in `tests/agents/` |
| **Healer** | Runs a failing test, finds out why, and proposes a fix | Edited test file |

The agents follow the same rule as the rest of this project: **AI proposes, a human decides.** Nothing an agent writes becomes part of the regression suite until a person reviews it in a pull request.

## What was added

- `.github/agents/playwright-test-planner.agent.md`, `…-generator.agent.md`, `…-healer.agent.md`: the agent definitions Copilot loads.
- `.vscode/mcp.json`: starts Playwright's test MCP server (`npx playwright run-test-mcp-server`), which gives the agents their browser and test tools.
- `tests/seed.spec.ts`: the starting point for every agent run. It opens the Sample Analysis Overview page through the existing `SamplesPage` page object. It also runs in the normal suite as `SEED-001`.
- `specs/`: where test plans are saved.
- `.github/workflows/copilot-setup-steps.yml`: environment for the Copilot **coding agent** on github.com (installs Node, Playwright browsers and starts the app). Only needed if you assign issues to Copilot on GitHub; VS Code doesn't use it.

The agent files were generated with `npx playwright init-agents --loop=vscode` (Playwright 1.58.2). After upgrading Playwright, run that command again so the agent definitions match the new version.

## Requirements

- VS Code 1.105 or newer
- GitHub Copilot with **Agent** mode
- Node.js 22 and `npm ci` run in the project
- Playwright browsers: `npx playwright install chromium`
- The **Playwright Test for VS Code** extension (recommended)

## How to use them

1. **Start the app** in a terminal: `npm start` (it runs on http://localhost:3000).
2. **Start the MCP server**: open `.vscode/mcp.json` and click **Start** above `playwright-test`.
3. **Open Copilot Chat**, switch to **Agent** mode and choose an agent from the agent picker.

### Planner
Pick `playwright-test-planner` and ask, for example:

> Using tests/seed.spec.ts, explore the Sample Analysis Overview page and plan tests for the sample table and the PASS / REVIEW labels. Save the plan as specs/sample-overview.md.

Read the plan and edit anything that is wrong or out of scope.

### Generator
Pick `playwright-test-generator` and ask:

> Generate tests for every scenario in specs/sample-overview.md. Save them under tests/agents/. Start each test title with an ID like AGT-001, and use the samplesPage fixture from fixtures/test-options.ts where it fits.

### Healer
When a test fails (for example after you change the page), pick `playwright-test-healer` and ask:

> Fix the failing tests in tests/agents/.

The healer can mark a test as skipped if it decides the app itself is broken. Treat that as a possible defect to investigate, not as a fix.

## Review rules before merging

1. Every agent-written test title starts with `AGT-###`, so the quality dashboard picks it up.
2. Add each new ID to the right requirement's `testIds` in `requirements/requirements.json`.
3. Check that assertions test real BioGuard rules (for example signal quality ≥ 0.80 is PASS), not just whatever the page happened to show.
4. Run `npm test` and make sure everything passes.
5. Open a pull request. The CI pipeline runs only the committed, reviewed tests; it never runs the agents.
