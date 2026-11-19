// All app icons come from Iconoir (https://iconoir.com, MIT). Import icons from this file, not from the package,
// so the whole app shares one size/stroke convention and the icon set can be swapped in one place.
import * as I from 'iconoir-react';

// Iconoir takes width/height; this adapter adds the `size` prop the app uses everywhere.
function wrap(Icon, defaults = {}) {
  function AppIcon({ size = 18, strokeWidth = 1.8, className = '', ...rest }) {
    return (
      <Icon
        width={size}
        height={size}
        strokeWidth={strokeWidth}
        className={`icon ${className}`.trim()}
        aria-hidden
        {...defaults}
        {...rest}
      />
    );
  }
  AppIcon.displayName = `Icon(${Icon.displayName || Icon.name || 'Iconoir'})`;
  return AppIcon;
}

// ---- UI icons (names kept from the old set so pages read naturally) ----
export const Sprout = wrap(I.Leaf);               // brand mark
export const LogOut = wrap(I.LogOut);
export const Compass = wrap(I.Compass);
export const Plus = wrap(I.Plus);
export const Sparkles = wrap(I.Sparks);
export const Award = wrap(I.Medal);
export const Brain = wrap(I.Brain);
export const Footprints = wrap(I.PathArrow);
export const HeartHandshake = wrap(I.Heart);
export const ArrowRight = wrap(I.ArrowRight);
export const ArrowLeft = wrap(I.ArrowLeft);
export const BookOpen = wrap(I.OpenBook);
export const Clock = wrap(I.Clock);
export const Frown = wrap(I.EmojiSad);
export const Search = wrap(I.Search);
export const SearchX = wrap(I.PageSearch);
export const Check = wrap(I.Check);
export const ChevronDown = wrap(I.NavArrowDown);
export const ExternalLink = wrap(I.OpenNewWindow);
export const FileText = wrap(I.Page);
export const GraduationCap = wrap(I.GraduationCap);
export const Hammer = wrap(I.Hammer);
export const Link2 = wrap(I.Link);
export const PartyPopper = wrap(I.Trophy);
export const Play = wrap(I.Play);

// ---- Domain icons, per domain slug (domains created later by admins fall back to their category icon) ----
const DOMAIN_ICONS = {
  'web-development': I.Code,
  programming: I.Terminal,
  'data-science-ai': I.BrainElectricity,
  cybersecurity: I.ShieldCheck,
  'mobile-app-development': I.SmartphoneDevice,
  electronics: I.ElectronicsChip,
  'electrical-engineering': I.Flash,
  'mechanical-engineering': I.Settings,
  'civil-engineering': I.City,
  mathematics: I.MathBook,
  physics: I.Atom,
  'business-entrepreneurship': I.Suitcase,
  'accounting-finance': I.Calculator,
  'digital-marketing': I.Megaphone,
  'aptitude-interview': I.ArrowArchery,
  photography: I.Camera,
  'graphic-design': I.DesignPencil,
  'video-editing': I.MediaVideo,
  music: I.MusicDoubleNote,
  'spoken-english': I.ChatBubbleTranslate,
  agriculture: I.Farm,
  'cooking-nutrition': I.OrganicFood,
  'health-fitness': I.Gym,
};

const CATEGORY_ICONS = {
  All: I.Sparks,
  Technology: I.Laptop,
  Engineering: I.Tools,
  'Science & Maths': I.Flask,
  'Business & Career': I.Suitcase,
  'Creative Arts': I.Palette,
  Languages: I.Language,
  'Life Skills': I.Leaf,
};

const cache = new Map();
const wrapped = (Icon) => {
  if (!cache.has(Icon)) cache.set(Icon, wrap(Icon));
  return cache.get(Icon);
};

export function CategoryIcon({ category, size = 18, ...rest }) {
  const Icon = wrapped(CATEGORY_ICONS[category] || I.Book);
  return <Icon size={size} strokeWidth={1.9} {...rest} />;
}

export function DomainIcon({ slug, category, size = 26, ...rest }) {
  const Icon = wrapped(DOMAIN_ICONS[slug] || CATEGORY_ICONS[category] || I.Brain);
  return <Icon size={size} strokeWidth={1.7} {...rest} />;
}
