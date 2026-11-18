/**
 * Starter catalogue. `npm run seed` upserts these; `npm run generate:starters`
 * drafts one beginner path (from `starter`) for every domain that has no path yet.
 */
export const CATEGORIES = ['Technology', 'Engineering', 'Science & Maths', 'Business & Career', 'Creative Arts', 'Languages', 'Life Skills'];

export const DOMAINS = [
  // Technology
  { category: 'Technology', name: 'Web Development', slug: 'web-development', icon: '💻', description: 'Build websites and web apps, from HTML to full-stack.', starter: 'HTML, CSS and JavaScript: build your first website' },
  { category: 'Technology', name: 'Programming', slug: 'programming', icon: '🐍', description: 'Learn to code from zero with Python, logic and problem solving.', starter: 'Python programming from absolute zero' },
  { category: 'Technology', name: 'Data Science & AI', slug: 'data-science-ai', icon: '🤖', description: 'Data analysis, machine learning and practical AI.', starter: 'Data analysis with Python and an introduction to machine learning' },
  { category: 'Technology', name: 'Cybersecurity', slug: 'cybersecurity', icon: '🛡️', description: 'Protect systems and data: networks, threats and safe practices.', starter: 'Cybersecurity fundamentals: networks, threats and defence' },
  { category: 'Technology', name: 'Mobile App Development', slug: 'mobile-app-development', icon: '📱', description: 'Build Android and cross-platform apps.', starter: 'Build your first mobile app with Flutter' },

  // Engineering departments
  { category: 'Engineering', name: 'Electronics', slug: 'electronics', icon: '🔌', description: 'Circuits, components, Arduino and embedded basics.', starter: 'Arduino for absolute beginners' },
  { category: 'Engineering', name: 'Electrical Engineering', slug: 'electrical-engineering', icon: '⚡', description: 'Circuits, machines, power systems and wiring.', starter: 'Electrical circuit fundamentals: Ohm\'s law to AC power' },
  { category: 'Engineering', name: 'Mechanical Engineering', slug: 'mechanical-engineering', icon: '⚙️', description: 'Mechanics, thermodynamics, manufacturing and CAD.', starter: 'Mechanical engineering basics and 2D/3D CAD design' },
  { category: 'Engineering', name: 'Civil Engineering', slug: 'civil-engineering', icon: '🏗️', description: 'Structures, materials, surveying and construction.', starter: 'Civil engineering basics: materials, structures and drawings' },

  // Science & Maths
  { category: 'Science & Maths', name: 'Mathematics', slug: 'mathematics', icon: '➗', description: 'From algebra to calculus and statistics.', starter: 'Algebra to calculus foundations' },
  { category: 'Science & Maths', name: 'Physics', slug: 'physics', icon: '🔭', description: 'Motion, energy, electricity and how the world works.', starter: 'Physics fundamentals: motion, forces and energy' },

  // Business & Career
  { category: 'Business & Career', name: 'Business & Entrepreneurship', slug: 'business-entrepreneurship', icon: '💼', description: 'Start, run and grow a business.', starter: 'Start your first small business' },
  { category: 'Business & Career', name: 'Accounting & Finance', slug: 'accounting-finance', icon: '📊', description: 'Bookkeeping, financial statements and money basics.', starter: 'Accounting basics and reading financial statements' },
  { category: 'Business & Career', name: 'Digital Marketing', slug: 'digital-marketing', icon: '📣', description: 'Social media, SEO, ads and content marketing.', starter: 'Digital marketing fundamentals: social media and SEO' },
  { category: 'Business & Career', name: 'Aptitude & Interview Prep', slug: 'aptitude-interview', icon: '🎯', description: 'Quantitative aptitude, reasoning and job interviews.', starter: 'Placement preparation: aptitude, reasoning and interviews' },

  // Creative Arts
  { category: 'Creative Arts', name: 'Photography', slug: 'photography', icon: '📷', description: 'Camera basics, composition, light and editing.', starter: 'Photography basics' },
  { category: 'Creative Arts', name: 'Graphic Design', slug: 'graphic-design', icon: '🎨', description: 'Design principles, typography and free design tools.', starter: 'Graphic design fundamentals with free tools' },
  { category: 'Creative Arts', name: 'Video Editing', slug: 'video-editing', icon: '🎬', description: 'Edit videos for YouTube and social media.', starter: 'Video editing for beginners with free software' },
  { category: 'Creative Arts', name: 'Music', slug: 'music', icon: '🎹', description: 'Learn an instrument and music theory.', starter: 'Keyboard and music theory for beginners' },

  // Languages
  { category: 'Languages', name: 'Spoken English', slug: 'spoken-english', icon: '🗣️', description: 'Confident everyday and professional English.', starter: 'Everyday spoken English for confident conversations' },

  // Life Skills
  { category: 'Life Skills', name: 'Agriculture & Farming', slug: 'agriculture', icon: '🌾', description: 'Organic farming, soil, crops and modern agri-tech.', starter: 'Organic farming basics for small farms' },
  { category: 'Life Skills', name: 'Cooking & Nutrition', slug: 'cooking-nutrition', icon: '🍳', description: 'Healthy cooking and nutrition basics.', starter: 'Healthy home cooking and nutrition basics' },
  { category: 'Life Skills', name: 'Health & Fitness', slug: 'health-fitness', icon: '💪', description: 'Exercise, home workouts and healthy habits.', starter: 'Home fitness for beginners: strength, mobility and habits' },
];
