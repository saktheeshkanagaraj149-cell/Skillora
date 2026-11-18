import {
  Atom, BookOpen, Brain, BrainCircuit, Briefcase, Building2, Calculator, ChefHat, CircuitBoard, Clapperboard,
  CodeXml, Cog, Dumbbell, FlaskConical, Languages, Laptop, Leaf, Megaphone, Palette, Piano, ShieldCheck,
  Sigma, Smartphone, Sparkles, Target, Terminal, Wheat, Wrench, Zap, Camera,
} from 'lucide-react';

// Icon per domain slug (domains created later by admins fall back to their category icon)
const DOMAIN_ICONS = {
  'web-development': CodeXml,
  programming: Terminal,
  'data-science-ai': BrainCircuit,
  cybersecurity: ShieldCheck,
  'mobile-app-development': Smartphone,
  electronics: CircuitBoard,
  'electrical-engineering': Zap,
  'mechanical-engineering': Cog,
  'civil-engineering': Building2,
  mathematics: Sigma,
  physics: Atom,
  'business-entrepreneurship': Briefcase,
  'accounting-finance': Calculator,
  'digital-marketing': Megaphone,
  'aptitude-interview': Target,
  photography: Camera,
  'graphic-design': Palette,
  'video-editing': Clapperboard,
  music: Piano,
  'spoken-english': Languages,
  agriculture: Wheat,
  'cooking-nutrition': ChefHat,
  'health-fitness': Dumbbell,
};

const CATEGORY_ICONS = {
  All: Sparkles,
  Technology: Laptop,
  Engineering: Wrench,
  'Science & Maths': FlaskConical,
  'Business & Career': Briefcase,
  'Creative Arts': Palette,
  Languages: Languages,
  'Life Skills': Leaf,
};

export function CategoryIcon({ category, size = 18, ...rest }) {
  const Icon = CATEGORY_ICONS[category] || BookOpen;
  return <Icon size={size} strokeWidth={2} aria-hidden {...rest} />;
}

export function DomainIcon({ slug, category, size = 26, ...rest }) {
  const Icon = DOMAIN_ICONS[slug] || CATEGORY_ICONS[category] || Brain;
  return <Icon size={size} strokeWidth={1.9} aria-hidden {...rest} />;
}
