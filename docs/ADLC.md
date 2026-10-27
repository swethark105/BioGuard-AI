# ADLC for AI-assisted quality engineering

This project demonstrates an **AI Development Life Cycle (ADLC)** adapted for QA, not a replacement for software development or a regulatory standard.

1. **Define:** Product owner documents fictional Jira-style requirements and measurable acceptance criteria.
2. **Assess risk:** QA assigns risk level and maps each requirement to a test objective.
3. **Generate:** Local LLM proposes additional boundary and negative scenarios. Output is untrusted and is **not executable automatically**.
4. **Review:** Human QA checks correctness, feasibility, traceability and missing edge cases; approved scenarios become deterministic Playwright tests.
5. **Execute:** Playwright runs UI and API tests; assertions determine pass/fail, never LLM judgment.
6. **Capture evidence:** HTML report, traces/screenshots on failures, JSON results and traceability dashboard.
7. **Investigate and improve:** AI may draft failure hypotheses (`npm run explain`), shown on the dashboard as unverified; engineers verify the cause and add regression coverage.

## Guardrails
- No patient data, real genomes, confidential company information or clinical claims.
- No LLM decisions for release gates; test results and risk ownership remain deterministic/human.
- AI output must be reviewed and versioned before inclusion in test suite.
- Traceability is illustrative evidence, not a validated quality management system.

