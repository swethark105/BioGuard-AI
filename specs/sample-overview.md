# Sample Analysis Overview Test Plan

## Application Overview

Verify the Sample Analysis Overview page's identity, informational copy, table structure, fictional sample values, and QC threshold outcomes. The overview is a read-only page: browser inspection found no links, buttons, or form controls. The seed test ran successfully and the page rendered all three rows. Observation: the browser logged a 404 response for /favicon.ico; page content remained available.

## Test Scenarios

### 1. Sample Analysis Overview

**Seed:** `tests/seed.spec.ts`

#### 1.1. AGT-001 displays all expected sample values and outcomes

**File:** `tests/agents/agt-001.spec.ts`

**Steps:**
  1. Start from a fresh browser state and run tests/seed.spec.ts to open the Sample Analysis Overview page.
    - expect: The page heading 'Sample Analysis Overview' is visible.
  2. Inspect the sample table and verify that it contains exactly three data rows, one for each expected sample.
    - expect: The table contains exactly three sample rows: SYN-001, SYN-002, and SYN-003.
  3. Check the SYN-001 row across the Sample ID, Fragment length, Signal quality, and QC outcome columns.
    - expect: SYN-001 shows fragment length 1200, signal quality 0.95, and outcome PASS.
  4. Check the SYN-002 row across the Sample ID, Fragment length, Signal quality, and QC outcome columns.
    - expect: SYN-002 shows fragment length 550, signal quality 0.81, and outcome PASS.
  5. Check the SYN-003 row across the Sample ID, Fragment length, Signal quality, and QC outcome columns.
    - expect: SYN-003 shows fragment length 3000, signal quality 0.62, and outcome REVIEW.
  6. Read the threshold note displayed beneath the table.
    - expect: The note states that signal quality ≥ 0.80 results in PASS and values below that threshold result in REVIEW.

#### 1.2. AGT-002 classifies SYN-002 as PASS just above the threshold

**File:** `tests/agents/agt-002.spec.ts`

**Steps:**
  1. Start from a fresh browser state and run tests/seed.spec.ts to open the Sample Analysis Overview page.
    - expect: The Sample Analysis Overview page is visible and the sample table has loaded.
  2. Locate the row labeled SYN-002 and inspect its signal-quality and QC-outcome cells.
    - expect: The signal quality is 0.81 and the outcome is PASS.
  3. Compare SYN-002's signal quality of 0.81 to the displayed threshold of 0.80.
    - expect: 0.81 is greater than 0.80, so SYN-002 is correctly classified as PASS; it must not be shown as REVIEW.

#### 1.3. AGT-003 shows REVIEW for SYN-003 below the threshold

**File:** `tests/agents/agt-003.spec.ts`

**Steps:**
  1. Start from a fresh browser state and run tests/seed.spec.ts to open the Sample Analysis Overview page.
    - expect: The Sample Analysis Overview page is visible and the sample table has loaded.
  2. Locate the row labeled SYN-003 and inspect its signal-quality and QC-outcome cells.
    - expect: The signal quality is 0.62 and the outcome is REVIEW.
  3. Compare SYN-003's signal quality of 0.62 to the displayed threshold of 0.80.
    - expect: 0.62 is below 0.80, so SYN-003 is correctly classified as REVIEW; it must not be shown as PASS.

#### 1.4. AGT-004 verifies page identity, disclaimer, and read-only structure

**File:** `tests/agents/agt-004.spec.ts`

**Steps:**
  1. Start from a fresh browser state and run tests/seed.spec.ts to open the Sample Analysis Overview page.
    - expect: The document title is 'BioGuard AI | Synthetic Lab'.
    - expect: A 'BioGuard AI' banner heading and the 'Synthetic Biotech Sample Quality Engineering Demo' subtitle are visible.
  2. Inspect the informational text at the beginning of the main content.
    - expect: The page displays 'Fictional data only. Not a medical or diagnostic application.'
  3. Inspect the sample table's column headers.
    - expect: The table headers are Sample ID, Fragment length, Signal quality, and QC outcome, in that order.
  4. Check for links, buttons, and form controls on the overview page.
    - expect: No links, buttons, or input, select, or textarea controls are present; the overview is read-only.
