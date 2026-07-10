function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

const NAME_ADJECTIVES = [
  "Midnight", "Neon", "Rusty", "Frosted", "Electric", "Muted", "Deep",
  "Hazy", "Bold", "Quiet", "Velvet", "Copper", "Arctic", "Ember",
];
const NAME_NOUNS = [
  "Harbor", "Signal", "Current", "Cargo", "Freight", "Voyage", "Anchor",
  "Tide", "Beacon", "Drift", "Passage", "Berth",
];

function randomName() {
  const a = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const n = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${a} ${n}`;
}

// Generates a full dark-mode-friendly palette from one random base hue plus
// an offset accent hue, so colors stay related instead of clashing.
export function generateRandomTheme() {
  const baseHue = Math.floor(rand(0, 360));
  const accentHue = Math.floor((baseHue + rand(30, 200)) % 360);
  const accent2Hue = Math.floor((accentHue + rand(20, 60)) % 360);
  const sat = rand(10, 22);

  const colors = {
    bg: hslToHex(baseHue, sat, rand(6, 10)),
    surface: hslToHex(baseHue, sat, rand(11, 15)),
    surfaceRaised: hslToHex(baseHue, sat, rand(16, 21)),
    border: hslToHex(baseHue, sat - 4, rand(24, 30)),
    text: hslToHex(baseHue, sat - 8, rand(90, 96)),
    textMuted: hslToHex(baseHue, sat - 10, rand(55, 65)),
    sidebarBg: hslToHex(baseHue, sat + 4, rand(4, 7)),
    sidebarText: hslToHex(baseHue, sat - 8, rand(72, 80)),
    sidebarActive: hslToHex(baseHue, sat, rand(18, 23)),
    primary: hslToHex(accentHue, rand(60, 80), rand(55, 65)),
    primaryText: "#ffffff",
    accent: hslToHex(accent2Hue, rand(60, 80), rand(58, 68)),
    success: hslToHex(145, rand(45, 60), rand(48, 58)),
    warning: hslToHex(42, rand(70, 85), rand(55, 65)),
    danger: hslToHex(355, rand(60, 75), rand(55, 63)),
  };

  return { name: randomName(), colors };
}
