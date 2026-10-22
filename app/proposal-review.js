
import fs from 'node:fs';
import path from 'node:path';

const proposalsFile = path.resolve('artifacts/ai-proposals.json');
const reviewsFile = path.resolve('artifacts/ai-reviews.json');

const allowedDecisions = new Set(['APPROVED', 'REVISE', 'REJECTED']);

export function getProposals() {
  if (fs.existsSync(proposalsFile)) {
    return JSON.parse(fs.readFileSync(proposalsFile, 'utf8'));
  }

  const demoFile = path.resolve('data/demo-proposals.json');

  if (fs.existsSync(demoFile)) {
    return JSON.parse(fs.readFileSync(demoFile, 'utf8'));
  }

  return { proposals: {}, message: 'No proposals available' };
}
export function getReviews() {
  if (!fs.existsSync(reviewsFile)) {
    return { reviews: {} };
  }
  return JSON.parse(fs.readFileSync(reviewsFile, 'utf8'));
}

export function saveReview({ requirementId, decision, comment }) {
  const data = getProposals();
  const proposals = data.proposals || {};

  const exists = Array.isArray(proposals)
    ? proposals.some(p => p.requirementId === requirementId)
    : Object.hasOwn(proposals, requirementId);

  if (!exists) {
    throw new Error('Unknown requirement ID');
  }

  if (!allowedDecisions.has(decision)) {
    throw new Error('Invalid review decision');
  }

  if (typeof comment !== 'string' || !comment.trim()) {
    throw new Error('Reviewer comment is required');
  }

  const dataReviews = getReviews();

  dataReviews.reviews[requirementId] = {
    decision,
    comment: comment.trim(),
    reviewedAt: new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(reviewsFile), { recursive: true });
  fs.writeFileSync(reviewsFile, JSON.stringify(dataReviews, null, 2));

  return dataReviews.reviews[requirementId];
}
