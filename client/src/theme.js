// Category look: colour hue + short tagline. Used by cards, banners and chips.
export const CATEGORY_ORDER = ['Technology', 'Engineering', 'Science & Maths', 'Business & Career', 'Creative Arts', 'Languages', 'Life Skills'];

const CATS = {
  Technology: { hue: 'blue', emoji: '💻' },
  Engineering: { hue: 'orange', emoji: '⚙️' },
  'Science & Maths': { hue: 'violet', emoji: '🔬' },
  'Business & Career': { hue: 'teal', emoji: '💼' },
  'Creative Arts': { hue: 'pink', emoji: '🎨' },
  Languages: { hue: 'amber', emoji: '🗣️' },
  'Life Skills': { hue: 'green', emoji: '🌿' },
};

export const catHue = (category) => CATS[category]?.hue || 'green';
export const catEmoji = (category) => CATS[category]?.emoji || '📚';
