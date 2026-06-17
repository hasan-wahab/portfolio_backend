/**
 * Ensures PUT body has the same top-level shape as Flutter `PortfolioContent.toJson()`.
 * Does not strip extra keys (forward-compatible).
 */
const REQUIRED_KEYS = [
  'brandName',
  'heroKicker',
  'heroNameLine1',
  'heroNameLine2',
  'heroInitials',
  'heroTagline',
  'heroBadges',
  'heroStats',
  'aboutSectionEyebrow',
  'aboutHeadline',
  'aboutParagraph1',
  'aboutParagraph2',
  'aboutCodeLine',
  'aboutAchievements',
  'aboutMiniStats',
  'projects',
  'experience',
  'testimonials',
  'contactEmail',
  'contactPhone',
  'contactLocation',
  'contactAvailability',
  'contactFormNameHint',
  'contactFormEmailHint',
  'contactFormMessageHint',
  'socialGithub',
  'socialLinkedIn',
  'socialX',
  'services',
  'skillRows',
];

const ARRAY_KEYS = new Set([
  'heroBadges',
  'heroStats',
  'aboutAchievements',
  'aboutMiniStats',
  'projects',
  'experience',
  'testimonials',
  'services',
  'skillRows',
]);

function validatePortfolioDocument(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('Body must be a JSON object');
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in doc)) {
      throw new Error(`Missing required field: ${key}`);
    }
  }
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(doc[key])) {
      throw new Error(`Field "${key}" must be an array`);
    }
  }
  try {
    JSON.stringify(doc);
  } catch (e) {
    throw new Error(`Document is not JSON-serializable: ${e.message}`);
  }
}

module.exports = { validatePortfolioDocument, REQUIRED_KEYS };
