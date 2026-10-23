import fs from 'node:fs';
import path from 'node:path';

// Reviews saved by earlier runs (or by hand in the dashboard) would otherwise
// leak into this run and change what the AI review tests see. The app and the
// test runner share the artifacts/ folder, so clearing it here resets the app.
export default function globalSetup() {
  const reviewsFile = path.resolve('artifacts/ai-reviews.json');
  fs.rmSync(reviewsFile, { force: true });
}
