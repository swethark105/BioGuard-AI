import fs from 'node:fs';

const requirements = JSON.parse(fs.readFileSync('requirements/requirements.json', 'utf8'));
const knownIds = new Set(requirements.map(r => r.id));

const endpoint = process.env.OLLAMA_URL || 'http://localhost:11434';
const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

const prompt = `You are a QA test-design assistant. Suggest 5 additional negative or boundary test scenarios for these fictional requirements.
Output a JSON object of the form {"proposals": [{"requirementId": "...", "scenario": "...", "expectedOutcome": "...", "reviewStatus": "PROPOSED"}]}.
Use only requirement IDs from the list. Always set reviewStatus to PROPOSED. Never assert regulatory compliance.
Requirements: ${JSON.stringify(requirements)}`;

// Turn the model's answer into the shape the review dashboard reads:
// { "REQ-002": {...}, "REQ-002 (2)": {...} } keyed by requirement ID.
function toDashboardProposals(result) {
  const list = Array.isArray(result)
    ? result
    : Array.isArray(result?.proposals)
      ? result.proposals
      : Object.values(result || {}).find(Array.isArray) || [];

  const proposals = {};
  for (const item of list) {
    if (!item || !knownIds.has(item.requirementId)) continue;
    if (typeof item.scenario !== 'string' || typeof item.expectedOutcome !== 'string') continue;

    let key = item.requirementId;
    for (let n = 2; Object.hasOwn(proposals, key); n++) key = `${item.requirementId} (${n})`;

    proposals[key] = {
      requirementId: item.requirementId,
      scenario: item.scenario,
      expectedOutcome: item.expectedOutcome,
      reviewStatus: 'PROPOSED'
    };
  }
  return proposals;
}

try {
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
    signal: AbortSignal.timeout(180000)
  });
  if (!response.ok) throw Error(`Ollama HTTP ${response.status}`);

  const payload = await response.json();
  const proposals = toDashboardProposals(JSON.parse(payload.response));
  const count = Object.keys(proposals).length;
  if (count === 0) throw Error('The model returned no usable proposals; try running it again');

  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/ai-proposals.json', JSON.stringify({
    model,
    generatedAt: new Date().toISOString(),
    reviewRequired: true,
    proposals
  }, null, 2));
  fs.rmSync('artifacts/ai-reviews.json', { force: true });

  console.log(`Saved ${count} unapproved proposals to artifacts/ai-proposals.json`);
  console.log('Review them at http://localhost:3000/ai-review');
} catch (e) {
  console.error('Optional AI unavailable:', e.message);
  process.exitCode = 1;
}
