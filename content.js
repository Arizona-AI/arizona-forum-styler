
console.log("[Arizona Styler] Content script loaded.");


let currentAccent1 = "#ff6b00";
let currentAccent2 = "#e100ff";
let originalFontFamily = "";
let initialLoadComplete = false;
let activeSettings = null;
let activeEnabled = true;
let activeBgSettings = null;
let activeTweaks = null;
let activeThemeId = null;
const usernameColorsCache = new Map();
let ecosystemApiData = null;

function captureOriginalFont(force = false) {
  if (originalFontFamily && !force) return;
  if (!document.body) return;

  const root = document.documentElement;
  const isEnabled = root.getAttribute("data-arizona-styler-enabled") === "true";
  
  if (isEnabled) {
    root.removeAttribute("data-arizona-styler-enabled");
  }
  
  const temp = document.createElement("div");
  document.body.appendChild(temp);
  const computed = window.getComputedStyle(temp).fontFamily;
  temp.remove();
  
  if (isEnabled) {
    root.setAttribute("data-arizona-styler-enabled", "true");
  }
  
  if (computed) {
    originalFontFamily = computed;
    console.log("[Arizona Styler] Captured original page font-family:", originalFontFamily);
    root.style.setProperty("--arizona-styler-original-font", originalFontFamily);
  }
}

let hasCachedSettings = false;
let isEnabledCached = true;

try {
  const cachedSettingsStr = localStorage.getItem("arizona-styler-cached-settings");
  const cachedEnabledStr = localStorage.getItem("arizona-styler-enabled");
  const cachedBgSettingsStr = localStorage.getItem("arizona-styler-bg-settings");
  const cachedTweaksStr = localStorage.getItem("arizona-styler-tweaks");
  const cachedThemeIdStr = localStorage.getItem("arizona-styler-theme-id");

  if (cachedEnabledStr !== null) {
    isEnabledCached = cachedEnabledStr !== "false";
  }

  if (cachedSettingsStr) {
    activeSettings = JSON.parse(cachedSettingsStr);
    activeEnabled = isEnabledCached;
    activeBgSettings = cachedBgSettingsStr ? JSON.parse(cachedBgSettingsStr) : null;
    activeTweaks = cachedTweaksStr ? JSON.parse(cachedTweaksStr) : null;
    activeThemeId = cachedThemeIdStr;
    hasCachedSettings = true;
  }
} catch (e) {
  console.warn("[Arizona Styler] Error parsing cached settings:", e);
}

if (activeEnabled && hasCachedSettings && activeSettings) {
  applyTheme(activeEnabled, activeSettings, activeBgSettings, activeThemeId, activeTweaks);
}

if (isEnabledCached && !hasCachedSettings) {
  const hideStyle = document.createElement("style");
  hideStyle.id = "arizona-styler-loading-hide";
  hideStyle.innerHTML = "html { opacity: 0 !important; }";
  if (document.documentElement) {
    document.documentElement.appendChild(hideStyle);
  } else {
    const obs = new MutationObserver((m, o) => {
      if (document.documentElement) {
        document.documentElement.appendChild(hideStyle);
        o.disconnect();
      }
    });
    obs.observe(document, { childList: true, subtree: true });
  }

  setTimeout(() => {
    const loadingHide = document.getElementById("arizona-styler-loading-hide");
    if (loadingHide) {
      loadingHide.remove();
      console.warn("[Arizona Styler] Safety timeout triggered. Showing page.");
    }
  }, 500);
}


chrome.storage.local.get(["enabled", "activeThemeId", "currentSettings", "globalBgSettings", "globalTweaks"], (data) => {
  console.log("[Arizona Styler] Storage retrieved:", data);
  const enabled = data.enabled !== undefined ? data.enabled : true;
  let settings = data.currentSettings;
  let bgSettings = data.globalBgSettings || { bgType: "color", bgUrl: "", bgOpacity: 40 };
  let tweaks = data.globalTweaks || { hideFooter: false, hideSidebar: false, hideAvatars: false, pageTransition: "none", ambientEffect: "none", cursor: "default", hidePostBg: false, copySelectedTextLink: false };

  if (!settings && data.activeThemeId) {
    
    const PRESETS = {
      midnight_slate: { mode: "dark", font: "system-ui, sans-serif", radius: 6, bg: "#0f1115", block: "#171b22", accent1: "#e2e8f0", accent2: "#3b82f6", text: "#f1f5f9" },
      arizona_sunset: { mode: "dark", font: "'Outfit', sans-serif", radius: 10, bg: "#121118", block: "#1a1924", accent1: "#e05a00", accent2: "#b500cc", text: "#dfddec" },
      cyberpunk_neon: { mode: "dark", font: "'Roboto', sans-serif", radius: 4, bg: "#0a0a12", block: "#12121c", accent1: "#ff007f", accent2: "#00e5ff", text: "#d0d7e0" },
      obsidian_copper: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#101012", block: "#1a1a1f", accent1: "#d35400", accent2: "#f39c12", text: "#e0e0e6" },
      nordic_frost: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#1e222b", block: "#252a36", accent1: "#88c0d0", accent2: "#81a1c1", text: "#d8dee9" },
      dracula_noir: { mode: "dark", font: "'Inter', sans-serif", radius: 10, bg: "#1e1f29", block: "#282a36", accent1: "#bd93f9", accent2: "#ff79c6", text: "#f8f8f2" },
      emerald_velvet: { mode: "dark", font: "'Montserrat', sans-serif", radius: 8, bg: "#0a0f0d", block: "#121a16", accent1: "#2ec4b6", accent2: "#2ecc71", text: "#e0ece4" },
      mocha_cream: { mode: "dark", font: "'Outfit', sans-serif", radius: 10, bg: "#181412", block: "#221d1a", accent1: "#d4a373", accent2: "#faedcd", text: "#f4efe9" },
      royal_amethyst: { mode: "dark", font: "'Outfit', sans-serif", radius: 12, bg: "#0e0d16", block: "#171526", accent1: "#9d4edd", accent2: "#ffb703", text: "#e3e1f0" },
      forest_moss: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#0f1110", block: "#181c19", accent1: "#2ec4b6", accent2: "#cbf3f0", text: "#e0ece4" },
      sakura_blossom: { mode: "light", font: "'Montserrat', sans-serif", radius: 12, bg: "#faf5f5", block: "#ffffff", accent1: "#ff758f", accent2: "#ffb3c1", text: "#332225" },
      classic_light: { mode: "light", font: "'Inter', sans-serif", radius: 8, bg: "#f4f5f7", block: "#ffffff", accent1: "#0066cc", accent2: "#00b4d8", text: "#1f2937" },
      
      
      steel_blue: { mode: "dark", font: "'Inter', sans-serif", radius: 6, bg: "#11141a", block: "#1b202a", accent1: "#4a90e2", accent2: "#81a1c1", text: "#e6ecf5" },
      rose_quartz: { mode: "dark", font: "'Outfit', sans-serif", radius: 10, bg: "#161318", block: "#201c24", accent1: "#f1a7b4", accent2: "#e0b0ff", text: "#f4eff6" },
      autumn_forest: { mode: "dark", font: "'Montserrat', sans-serif", radius: 8, bg: "#18130f", block: "#231d18", accent1: "#d35400", accent2: "#f39c12", text: "#f5ebe0" },
      iceberg_light: { mode: "light", font: "'Outfit', sans-serif", radius: 8, bg: "#e9edf0", block: "#ffffff", accent1: "#008080", accent2: "#20b2aa", text: "#2c3e50" },
      sandstorm: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#1a1815", block: "#24211d", accent1: "#dfb15b", accent2: "#f2d388", text: "#f5f0eb" },
      sage_stone: { mode: "dark", font: "'Inter', sans-serif", radius: 6, bg: "#141716", block: "#1e2220", accent1: "#8eb897", accent2: "#a3cfa2", text: "#ebf2ee" },
      carbon_cyan: { mode: "dark", font: "'JetBrains Mono', monospace", radius: 4, bg: "#0d0d0f", block: "#16161c", accent1: "#00e5ff", accent2: "#008b8b", text: "#e3e3e6" },
      plum_wine: { mode: "dark", font: "'Montserrat', sans-serif", radius: 10, bg: "#140f16", block: "#201a24", accent1: "#da70d6", accent2: "#ba55d3", text: "#f3eef5" },
      midnight_gold: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#0c0d0e", block: "#15171a", accent1: "#d4af37", accent2: "#aa7c11", text: "#f4f2ee" },
      cyberpunk_slate: { mode: "dark", font: "'Roboto', sans-serif", radius: 6, bg: "#101216", block: "#181c22", accent1: "#ffaa00", accent2: "#00ffcc", text: "#e2e6ea" },
      copper_mine: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#161210", block: "#221b18", accent1: "#e07a5f", accent2: "#f4a261", text: "#fdf8f5" },
      teal_breeze: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#0b1315", block: "#131f22", accent1: "#3a9d8f", accent2: "#2a9d8f", text: "#e8f1f2" },
      nordic_light: { mode: "light", font: "'Inter', sans-serif", radius: 8, bg: "#f0f4f8", block: "#ffffff", accent1: "#4c566a", accent2: "#88c0d0", text: "#2e3440" },
      retro_slate: { mode: "dark", font: "'Roboto', sans-serif", radius: 6, bg: "#1e1e24", block: "#2a2b30", accent1: "#8a9a86", accent2: "#d9e5d6", text: "#f4f4f6" },
      platinum: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#121315", block: "#1c1e22", accent1: "#e5e5e5", accent2: "#007acc", text: "#f5f6f8" },
      solar_flare: { mode: "dark", font: "'Montserrat', sans-serif", radius: 8, bg: "#141111", block: "#221b1b", accent1: "#ff5722", accent2: "#ff9800", text: "#fbebe6" },
      abyss: { mode: "dark", font: "'Roboto', sans-serif", radius: 4, bg: "#05070a", block: "#0d1117", accent1: "#58a6ff", accent2: "#1f6feb", text: "#c9d1d9" },
      mint_frost: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#101513", block: "#19221e", accent1: "#a3e2c9", accent2: "#7fc8a9", text: "#e8f5f0" },
      lilac_mist: { mode: "dark", font: "'Outfit', sans-serif", radius: 12, bg: "#131218", block: "#1e1b26", accent1: "#c8b6ff", accent2: "#b8c0ff", text: "#f1eff7" },
      charcoal_rose: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#141213", block: "#201c1e", accent1: "#e5989b", accent2: "#ffb5a7", text: "#f7f1f2" },
      peach_puff: { mode: "light", font: "'Outfit', sans-serif", radius: 10, bg: "#fff5eb", block: "#ffffff", accent1: "#ff7d3b", accent2: "#ffb58a", text: "#4a2c1a" },
      lavender_fields: { mode: "light", font: "'Montserrat', sans-serif", radius: 12, bg: "#f5f3ff", block: "#ffffff", accent1: "#7c3aed", accent2: "#c4b5fd", text: "#2e1065" },
      minty_fresh: { mode: "light", font: "'Inter', sans-serif", radius: 8, bg: "#f0fdf4", block: "#ffffff", accent1: "#059669", accent2: "#6ee7b7", text: "#064e3b" },
      cyberpunk_light: { mode: "light", font: "'Roboto', sans-serif", radius: 4, bg: "#f8fafc", block: "#ffffff", accent1: "#ff007f", accent2: "#00e5ff", text: "#0f172a" },
      solarized_light: { mode: "light", font: "'Inter', sans-serif", radius: 6, bg: "#fdf6e3", block: "#eee8d5", accent1: "#b58900", accent2: "#2aa198", text: "#586e75" },
      ocean_breeze: { mode: "light", font: "'Outfit', sans-serif", radius: 8, bg: "#f0f9ff", block: "#ffffff", accent1: "#0284c7", accent2: "#f43f5e", text: "#0c4a6e" },
      lemon_sorbet: { mode: "light", font: "'Montserrat', sans-serif", radius: 10, bg: "#fefce8", block: "#ffffff", accent1: "#ca8a04", accent2: "#84cc16", text: "#422006" },
      elegance_gold: { mode: "light", font: "'Outfit', sans-serif", radius: 8, bg: "#fafaf9", block: "#f5f5f4", accent1: "#d97706", accent2: "#44403c", text: "#1c1917" },
      forest_dew: { mode: "light", font: "'Inter', sans-serif", radius: 8, bg: "#f4f7f4", block: "#ffffff", accent1: "#15803d", accent2: "#eab308", text: "#14532d" },
      crimson_glaze: { mode: "light", font: "'Montserrat', sans-serif", radius: 8, bg: "#fff5f5", block: "#ffffff", accent1: "#dc2626", accent2: "#f43f5e", text: "#450a0a" },
      barbie_pink: { mode: "light", font: "'Outfit', sans-serif", radius: 12, bg: "#fff1f2", block: "#ffffff", accent1: "#db2777", accent2: "#a21caf", text: "#4c0519" },
      coffee_latte: { mode: "light", font: "'Outfit', sans-serif", radius: 10, bg: "#faf7f2", block: "#f5efe6", accent1: "#854d0e", accent2: "#b45309", text: "#451a03" },
      neon_toxic: { mode: "dark", font: "'JetBrains Mono', monospace", radius: 4, bg: "#080c08", block: "#101810", accent1: "#39ff14", accent2: "#bd00ff", text: "#e2f0e2" },
      deep_sea: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#050c14", block: "#0b1623", accent1: "#00bcd4", accent2: "#009688", text: "#e0f2f1" },
      sunset_glow: { mode: "dark", font: "'Outfit', sans-serif", radius: 10, bg: "#0d0b14", block: "#171324", accent1: "#ff5e00", accent2: "#ff007f", text: "#f5effa" },
      retro_vaporwave: { mode: "dark", font: "'Roboto', sans-serif", radius: 6, bg: "#120924", block: "#1c1236", accent1: "#ff00a0", accent2: "#00feff", text: "#f1eef8" },
      zen_garden: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#121513", block: "#1a201c", accent1: "#66bb6a", accent2: "#81c784", text: "#e8f5e9" },
      crimson_eclipse: { mode: "dark", font: "'Montserrat', sans-serif", radius: 6, bg: "#0a0404", block: "#140a0a", accent1: "#e53935", accent2: "#ff1744", text: "#ffebee" },
      mono_high_contrast: { mode: "dark", font: "'Inter', sans-serif", radius: 6, bg: "#000000", block: "#121212", accent1: "#ffffff", accent2: "#b0bec5", text: "#ffffff" },
      cosmic_nebula: { mode: "dark", font: "'Outfit', sans-serif", radius: 12, bg: "#070512", block: "#110d24", accent1: "#8e24aa", accent2: "#d81b60", text: "#f3e5f5" },
      warm_hearth: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#140f0c", block: "#1f1612", accent1: "#ff8f00", accent2: "#e65100", text: "#efebe9" },
      aero_blue: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#0d131a", block: "#161f2b", accent1: "#4fc3f7", accent2: "#81d4fa", text: "#e1f5fe" },
      golden_velvet: { mode: "dark", font: "'Outfit', sans-serif", radius: 10, bg: "#100d08", block: "#1a1610", accent1: "#ffd700", accent2: "#ffb300", text: "#fffdf7" },
      midnight_violet: { mode: "dark", font: "'Montserrat', sans-serif", radius: 8, bg: "#0a0614", block: "#120e24", accent1: "#9c27b0", accent2: "#e040fb", text: "#f3e5f5" },
      neon_lime: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#0a0b0a", block: "#121412", accent1: "#a3e635", accent2: "#ffffff", text: "#e2e8f0" },
      cyber_grape: { mode: "dark", font: "'Poppins', sans-serif", radius: 10, bg: "#0b0914", block: "#131122", accent1: "#8b5cf6", accent2: "#ec4899", text: "#ede9fe" },
      rust_iron: { mode: "dark", font: "'Fira Sans', sans-serif", radius: 6, bg: "#140f0d", block: "#1c1614", accent1: "#ea580c", accent2: "#94a3b8", text: "#f1f5f9" },
      frozen_ocean: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#060b13", block: "#0e1520", accent1: "#0ea5e9", accent2: "#38bdf8", text: "#e0f2fe" },
      toxic_waste: { mode: "dark", font: "'JetBrains Mono', monospace", radius: 6, bg: "#0b0f0b", block: "#151c15", accent1: "#22c55e", accent2: "#eab308", text: "#f0fdf4" },
      magma_core: { mode: "dark", font: "'Oswald', sans-serif", radius: 4, bg: "#0c0707", block: "#170e0e", accent1: "#ef4444", accent2: "#f97316", text: "#fef2f2" },
      nebula_dust: { mode: "dark", font: "'Raleway', sans-serif", radius: 12, bg: "#080711", block: "#121024", accent1: "#2563eb", accent2: "#f472b6", text: "#f3e8ff" },
      charcoal_gold: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#111111", block: "#1a1a1a", accent1: "#eab308", accent2: "#ca8a04", text: "#fafafa" },
      crimson_rose: { mode: "dark", font: "'Nunito', sans-serif", radius: 10, bg: "#12090d", block: "#1c1116", accent1: "#db2777", accent2: "#be185d", text: "#fdf2f8" },
      synth_dream: { mode: "dark", font: "'Rubik', sans-serif", radius: 8, bg: "#0f081d", block: "#19112d", accent1: "#ff007f", accent2: "#00f0ff", text: "#f5efff" },
      sakura_breeze: { mode: "light", font: "'Poppins', sans-serif", radius: 12, bg: "#fdf2f8", block: "#ffffff", accent1: "#ec4899", accent2: "#f43f5e", text: "#4c0519" },
      ocean_surf: { mode: "light", font: "'Inter', sans-serif", radius: 8, bg: "#f0fdfa", block: "#ffffff", accent1: "#0d9488", accent2: "#0284c7", text: "#042f2e" },
      sunny_daisy: { mode: "light", font: "'Nunito', sans-serif", radius: 10, bg: "#fefce8", block: "#ffffff", accent1: "#eab308", accent2: "#16a34a", text: "#422006" },
      lilac_cream: { mode: "light", font: "'Raleway', sans-serif", radius: 12, bg: "#faf5ff", block: "#ffffff", accent1: "#a855f7", accent2: "#d8b4fe", text: "#3b0764" },
      fresh_meadow: { mode: "light", font: "'Fira Sans', sans-serif", radius: 8, bg: "#f0fdf4", block: "#ffffff", accent1: "#15803d", accent2: "#22c55e", text: "#052e16" },
      apricot_glow: { mode: "light", font: "'Poppins', sans-serif", radius: 10, bg: "#fff7ed", block: "#ffffff", accent1: "#f97316", accent2: "#f59e0b", text: "#431407" },
      skyline_blue: { mode: "light", font: "'Inter', sans-serif", radius: 8, bg: "#f8fafc", block: "#ffffff", accent1: "#2563eb", accent2: "#475569", text: "#0f172a" },
      warm_sand: { mode: "light", font: "'Outfit', sans-serif", radius: 8, bg: "#faf7f2", block: "#ffffff", accent1: "#d97706", accent2: "#b45309", text: "#451a03" },
      rosewater: { mode: "light", font: "'Poppins', sans-serif", radius: 12, bg: "#fff1f2", block: "#ffffff", accent1: "#f43f5e", accent2: "#9f1239", text: "#4c0519" },
      slate_clean: { mode: "light", font: "'Fira Sans', sans-serif", radius: 6, bg: "#f1f5f9", block: "#ffffff", accent1: "#475569", accent2: "#3b82f6", text: "#1e293b" },
      space_odyssey: { mode: "dark", font: "'Raleway', sans-serif", radius: 12, bg: "#07080e", block: "#111322", accent1: "#2563eb", accent2: "#facc15", text: "#f1f5f9" },
      neon_samurai: { mode: "dark", font: "'Montserrat', sans-serif", radius: 5, bg: "#0c0608", block: "#180d11", accent1: "#ff003c", accent2: "#8b5cf6", text: "#f8fafc" },
      deep_emerald: { mode: "dark", font: "'Playfair Display', serif", radius: 8, bg: "#050a07", block: "#0e1812", accent1: "#10b981", accent2: "#fbbf24", text: "#f4fbf7" },
      vampire_castle: { mode: "dark", font: "'Playfair Display', serif", radius: 6, bg: "#090203", block: "#1a070a", accent1: "#dc2626", accent2: "#7c3aed", text: "#fcf8f8" },
      vintage_terminal: { mode: "dark", font: "'JetBrains Mono', monospace", radius: 2, bg: "#050705", block: "#0d140d", accent1: "#f59e0b", accent2: "#d97706", text: "#fbbf24" },
      nordic_aurora: { mode: "dark", font: "'Inter', sans-serif", radius: 8, bg: "#0f121d", block: "#1a2035", accent1: "#10b981", accent2: "#06b6d4", text: "#f1f5f9" },
      ghostly_whisper: { mode: "dark", font: "'Raleway', sans-serif", radius: 14, bg: "#13141a", block: "#1e202e", accent1: "#c084fc", accent2: "#94a3b8", text: "#f1f5f9" },
      pumpkin_spice: { mode: "dark", font: "'Comfortaa', cursive", radius: 10, bg: "#130d0a", block: "#221610", accent1: "#f97316", accent2: "#fbbf24", text: "#fafaf9" },
      abyssal_trench: { mode: "dark", font: "'Inter', sans-serif", radius: 6, bg: "#020408", block: "#0a0f1d", accent1: "#06b6d4", accent2: "#3b82f6", text: "#f1f5f9" },
      royal_sapphire: { mode: "dark", font: "'Outfit', sans-serif", radius: 10, bg: "#090e1a", block: "#131b33", accent1: "#3b82f6", accent2: "#eab308", text: "#f8fafc" },
      cyber_glitch: { mode: "dark", font: "'JetBrains Mono', monospace", radius: 0, bg: "#08080a", block: "#101116", accent1: "#22c55e", accent2: "#ef4444", text: "#f3f4f6" },
      sunset_mirage: { mode: "dark", font: "'Poppins', sans-serif", radius: 12, bg: "#120917", block: "#23122c", accent1: "#f43f5e", accent2: "#fb7185", text: "#fae8ff" },
      retro_arcade: { mode: "dark", font: "'Rubik', sans-serif", radius: 4, bg: "#0a071b", block: "#151035", accent1: "#ec4899", accent2: "#eab308", text: "#fdf4ff" },
      warm_caramel: { mode: "dark", font: "'Nunito', sans-serif", radius: 10, bg: "#18110b", block: "#2a1e14", accent1: "#f59e0b", accent2: "#fed7aa", text: "#fffbeb" },
      ice_cavern: { mode: "dark", font: "'Fira Sans', sans-serif", radius: 8, bg: "#0a0f14", block: "#121b24", accent1: "#60a5fa", accent2: "#f8fafc", text: "#f0f7ff" },
      onyx_gold: { mode: "dark", font: "'Outfit', sans-serif", radius: 8, bg: "#0a0a0a", block: "#141414", accent1: "#eab308", accent2: "#fafafa", text: "#f5f5f5" },
      cyberpunk_2077: { mode: "dark", font: "'Roboto', sans-serif", radius: 5, bg: "#0e0d07", block: "#18170c", accent1: "#facc15", accent2: "#06b6d4", text: "#fafaf9" },
      enchanted_forest: { mode: "dark", font: "'Raleway', sans-serif", radius: 12, bg: "#070c08", block: "#121e14", accent1: "#22c55e", accent2: "#a855f7", text: "#f0fdf4" },
      molten_metal: { mode: "dark", font: "'Oswald', sans-serif", radius: 6, bg: "#0f0d0c", block: "#221d1b", accent1: "#f97316", accent2: "#fb923c", text: "#fafaf9" },
      pastel_goth: { mode: "dark", font: "'Comfortaa', cursive", radius: 10, bg: "#0f0e15", block: "#1a1924", accent1: "#f472b6", accent2: "#34d399", text: "#fdf2f8" },
      marshmallow_cloud: { mode: "light", font: "'Comfortaa', cursive", radius: 14, bg: "#f5f7fa", block: "#ffffff", accent1: "#60a5fa", accent2: "#f472b6", text: "#1e293b" },
      strawberry_cream: { mode: "light", font: "'Poppins', sans-serif", radius: 12, bg: "#fff5f5", block: "#ffffff", accent1: "#ef4444", accent2: "#fda4af", text: "#450a0a" },
      matcha_latte: { mode: "light", font: "'Inter', sans-serif", radius: 10, bg: "#f4f8f4", block: "#ffffff", accent1: "#10b981", accent2: "#a7f3d0", text: "#064e3b" },
      lemon_meringue: { mode: "light", font: "'Outfit', sans-serif", radius: 8, bg: "#fffbeb", block: "#ffffff", accent1: "#eab308", accent2: "#fde047", text: "#451a03" },
      vintage_paper: { mode: "light", font: "'Playfair Display', serif", radius: 4, bg: "#f7f4eb", block: "#fbfaf7", accent1: "#78350f", accent2: "#451a03", text: "#1c1917" },
      summer_citrus: { mode: "light", font: "'Nunito', sans-serif", radius: 10, bg: "#fff7ed", block: "#ffffff", accent1: "#f97316", accent2: "#84cc16", text: "#431407" },
      sea_salt: { mode: "light", font: "'Fira Sans', sans-serif", radius: 8, bg: "#f1f5f9", block: "#ffffff", accent1: "#3b82f6", accent2: "#e2e8f0", text: "#0f172a" },
      orchid_garden: { mode: "light", font: "'Montserrat', sans-serif", radius: 12, bg: "#faf5ff", block: "#ffffff", accent1: "#a855f7", accent2: "#c084fc", text: "#3b0764" },
      nordic_minimalist: { mode: "light", font: "'Inter', sans-serif", radius: 6, bg: "#f8fafc", block: "#ffffff", accent1: "#475569", accent2: "#cbd5e1", text: "#0f172a" },
      honey_peach: { mode: "light", font: "'Outfit', sans-serif", radius: 12, bg: "#fffaf5", block: "#ffffff", accent1: "#fb923c", accent2: "#fcd34d", text: "#431407" },
      breeze_mint: { mode: "light", font: "'Comfortaa', cursive", radius: 10, bg: "#f0fdf4", block: "#ffffff", accent1: "#14b8a6", accent2: "#99f6e4", text: "#042f2e" },
      vintage_rose: { mode: "light", font: "'Playfair Display', serif", radius: 8, bg: "#fbf7f7", block: "#ffffff", accent1: "#db2777", accent2: "#86efac", text: "#4c0519" },
      blueberry_yogurt: { mode: "light", font: "'Rubik', sans-serif", radius: 10, bg: "#f5f6ff", block: "#ffffff", accent1: "#3b82f6", accent2: "#c7d2fe", text: "#1e1b4b" },
      golden_hour: { mode: "light", font: "'Outfit', sans-serif", radius: 10, bg: "#fffbeb", block: "#ffffff", accent1: "#eab308", accent2: "#f97316", text: "#451a03" },
      desert_sage: { mode: "light", font: "'Montserrat', sans-serif", radius: 8, bg: "#f4f6f4", block: "#ffffff", accent1: "#15803d", accent2: "#f97316", text: "#14532d" },
      clean_minimal: { mode: "light", font: "'Inter', sans-serif", radius: 6, bg: "#f8fafc", block: "#ffffff", accent1: "#2563eb", accent2: "#e2e8f0", text: "#0f172a" },
      cherry_blossom: { mode: "light", font: "'Raleway', sans-serif", radius: 12, bg: "#fff5f7", block: "#ffffff", accent1: "#db2777", accent2: "#fbcfe8", text: "#4c0519" },
      banana_split: { mode: "light", font: "'Comfortaa', cursive", radius: 12, bg: "#fefce8", block: "#ffffff", accent1: "#eab308", accent2: "#b45309", text: "#422006" },
      sweet_lavender: { mode: "light", font: "'Poppins', sans-serif", radius: 10, bg: "#faf5ff", block: "#ffffff", accent1: "#7c3aed", accent2: "#ddd6fe", text: "#2e1065" },
      pistachio_macaron: { mode: "light", font: "'Rubik', sans-serif", radius: 12, bg: "#f0fdf4", block: "#ffffff", accent1: "#22c55e", accent2: "#fef08a", text: "#052e16" }
    };
    settings = PRESETS[data.activeThemeId] || PRESETS.midnight_slate;
  }

  if (!settings) {
    settings = {
      mode: "dark",
      font: "system-ui, sans-serif",
      radius: 6,
      bg: "#0f1115",
      block: "#171b22",
      accent1: "#e2e8f0",
      accent2: "#3b82f6",
      text: "#f1f5f9",
      loadingAnimation: "none"
    };
  }

  console.log("[Arizona Styler] Active settings to apply:", settings, bgSettings);
  applyTheme(enabled, settings, bgSettings, data.activeThemeId, tweaks);

  const loadingHide = document.getElementById("arizona-styler-loading-hide");
  if (loadingHide) {
    loadingHide.remove();
  }
  initialLoadComplete = true;
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "APPLY_THEME") {
    const oldAnim = activeSettings ? activeSettings.loadingAnimation : "none";
    const newAnim = message.settings ? message.settings.loadingAnimation : "none";

    applyTheme(message.enabled, message.settings, message.bgSettings, message.activeThemeId, message.tweaks);

    if (message.enabled && newAnim !== "none" && oldAnim !== newAnim) {
      triggerAppearAnimation(newAnim);
    }
  }
});


function triggerAppearAnimation(animationType) {
  const root = document.documentElement;
  root.removeAttribute("data-arizona-styler-appear");
  void root.offsetWidth;
  if (animationType && animationType !== "none") {
    root.setAttribute("data-arizona-styler-appear", animationType);
  }
}


function applyTheme(enabled, settings, bgSettings, themeId, tweaks) {
  const root = document.documentElement;
  activeSettings = settings;
  activeEnabled = enabled;
  activeBgSettings = bgSettings;
  activeTweaks = tweaks;
  activeThemeId = themeId;

  if (enabled) {
    captureOriginalFont();
  }

  const loadingHide = document.getElementById("arizona-styler-loading-hide");
  if (loadingHide) {
    loadingHide.remove();
  }

  const navList = document.querySelector(".p-nav-list.js-offCanvasNavSource");
  if (navList) {
    navList.removeAttribute("data-arizona-styler-navbar-processed");
  }

  if (!enabled) {
    root.removeAttribute("data-arizona-styler-enabled");
    root.removeAttribute("data-arizona-styler-mode");
    root.removeAttribute("data-arizona-styler-theme");
    root.removeAttribute("data-arizona-styler-avatar-style");
    root.removeAttribute("data-arizona-styler-font-apply");
    root.removeAttribute("data-arizona-styler-remove-user-paints");
    root.removeAttribute("data-arizona-styler-hide-user-banners");
    root.removeAttribute("data-arizona-styler-hide-ecosystem-badges");
    root.removeAttribute("data-arizona-styler-logo-type");
    root.removeAttribute("data-arizona-styler-accent-threads-meta");
    root.removeAttribute("data-arizona-styler-accent-post-attribution");
    root.removeAttribute("data-arizona-styler-accent-buttons");
    root.removeAttribute("data-arizona-styler-accent-thread-list");
    root.style.removeProperty("--arizona-styler-logo-custom-src");
    root.removeAttribute("data-arizona-styler-hide-footer");
    root.removeAttribute("data-arizona-styler-hide-sidebar");
    root.removeAttribute("data-arizona-styler-hide-avatars");
    root.removeAttribute("data-arizona-styler-hide-your-posts");
    root.removeAttribute("data-arizona-styler-hide-new-indicator");
    root.removeAttribute("data-arizona-styler-hide-new-thread-indicator");
    root.removeAttribute("data-arizona-styler-hide-node-icons");
    root.removeAttribute("data-arizona-styler-hide-conversations");
    root.removeAttribute("data-arizona-styler-hide-alerts");
    root.removeAttribute("data-arizona-styler-hide-subforums");
    root.removeAttribute("data-arizona-styler-hide-prefixes");
    root.removeAttribute("data-arizona-styler-hide-signatures");
    root.removeAttribute("data-arizona-styler-hide-style-variation");
    root.removeAttribute("data-arizona-styler-hide-breadcrumbs");
    root.removeAttribute("data-arizona-styler-hide-section-links");
    root.removeAttribute("data-arizona-styler-hide-user-extras");
    root.removeAttribute("data-arizona-styler-hide-post-bg");
    root.removeAttribute("data-arizona-styler-animated-avatars");
    root.removeAttribute("data-arizona-styler-nav-search");
    root.removeAttribute("data-arizona-styler-node-icon-status");
    root.removeAttribute("data-arizona-styler-cursor");
    root.removeAttribute("data-arizona-styler-appear");
    root.removeAttribute("data-arizona-styler-accent-new-badge");
    root.removeAttribute("data-arizona-styler-banned-style");
     applyDynamicCursor("default", "#ff6b00", 2);
    stopAmbientEffect();
    applyNavbarHiding([]);
    renderCustomNavItems([]);
    
    root.removeAttribute("style");

    document.querySelectorAll('.avatar[data-arizona-styler-paint-processed="true"]').forEach(el => {
      el.style.removeProperty('--avatar-paint-color');
      el.removeAttribute('data-arizona-styler-paint-processed');
    });
    document.querySelectorAll('.avatar[data-arizona-styler-avatar-checked]').forEach(el => {
      el.removeAttribute('data-arizona-styler-avatar-checked');
    });
    document.querySelectorAll('.avatar[data-arizona-styler-avatar-anim-checked]').forEach(el => {
      el.removeAttribute('data-arizona-styler-avatar-anim-checked');
    });
    document.querySelectorAll('.userBanner[data-arizona-styler-banner-processed]').forEach(el => {
      el.style.removeProperty('--user-banner-filter');
      el.removeAttribute('data-arizona-styler-banner-processed');
    });
    resetBadges();

    updateAnimatedAvatars();
    
    const videoEl = document.getElementById("arizona-styler-bg-video");
    if (videoEl) videoEl.remove();
    return;
  }

  
  currentAccent1 = settings.accent1;
  currentAccent2 = settings.accent2;

  root.setAttribute("data-arizona-styler-enabled", "true");
  root.setAttribute("data-arizona-styler-mode", settings.mode);
  if (settings.loadingAnimation && settings.loadingAnimation !== "none") {
    root.setAttribute("data-arizona-styler-appear", settings.loadingAnimation);
  } else {
    root.removeAttribute("data-arizona-styler-appear");
  }
  if (activeThemeId) {
    root.setAttribute("data-arizona-styler-theme", activeThemeId);
  } else {
    root.removeAttribute("data-arizona-styler-theme");
  }

  const threadsMeta = settings.accentThreadsMeta !== undefined ? settings.accentThreadsMeta : true;
  const postAttribution = settings.accentPostAttribution !== undefined ? settings.accentPostAttribution : true;
  const buttons = settings.accentButtons !== undefined ? settings.accentButtons : true;
  const threadList = settings.accentThreadList !== undefined ? settings.accentThreadList : true;
  const newBadge = settings.accentNewBadge !== undefined ? settings.accentNewBadge : true;

  const bannedStyle = settings.bannedUserStyle || "default";
  root.setAttribute("data-arizona-styler-banned-style", bannedStyle);

  root.setAttribute("data-arizona-styler-accent-threads-meta", threadsMeta ? "true" : "false");
  root.setAttribute("data-arizona-styler-accent-post-attribution", postAttribution ? "true" : "false");
  root.setAttribute("data-arizona-styler-accent-buttons", buttons ? "true" : "false");
  root.setAttribute("data-arizona-styler-accent-thread-list", threadList ? "true" : "false");
  root.setAttribute("data-arizona-styler-accent-new-badge", newBadge ? "true" : "false");

  if (settings.avatarStyle) {
    root.setAttribute("data-arizona-styler-avatar-style", settings.avatarStyle);
  } else {
    root.setAttribute("data-arizona-styler-avatar-style", "default");
  }

  if (settings.fontApply) {
    root.setAttribute("data-arizona-styler-font-apply", settings.fontApply);
  } else {
    root.setAttribute("data-arizona-styler-font-apply", "partial");
  }

  if (settings.removeUserPaints) {
    root.setAttribute("data-arizona-styler-remove-user-paints", "true");
  } else {
    root.removeAttribute("data-arizona-styler-remove-user-paints");
  }

  if (settings.hideUserBanners) {
    root.setAttribute("data-arizona-styler-hide-user-banners", "true");
  } else {
    root.removeAttribute("data-arizona-styler-hide-user-banners");
  }

  if (settings.logoType) {
    root.setAttribute("data-arizona-styler-logo-type", settings.logoType);
  } else {
    root.setAttribute("data-arizona-styler-logo-type", "accent-static");
  }

  if (settings.logoUrl) {
    root.style.setProperty("--arizona-styler-logo-custom-src", `url("${settings.logoUrl}")`);
  } else {
    root.style.removeProperty("--arizona-styler-logo-custom-src");
  }

  const glassOpacityAttr = settings.glassOpacity !== undefined ? settings.glassOpacity : 100;
  const glassBlurAttr = settings.glassBlur !== undefined ? settings.glassBlur : 0;
  if (glassOpacityAttr < 100) {
    if (glassBlurAttr > 0) {
      root.setAttribute("data-arizona-styler-glass-style", "glassmorphism");
    } else {
      root.setAttribute("data-arizona-styler-glass-style", "transparent");
    }
  } else {
    root.removeAttribute("data-arizona-styler-glass-style");
  }

  if (settings.avatarStyle !== "paint-accent" && settings.avatarStyle !== "paint-glow") {
    document.querySelectorAll('.avatar[data-arizona-styler-paint-processed="true"]').forEach(el => {
      el.style.removeProperty('--avatar-paint-color');
      el.removeAttribute('data-arizona-styler-paint-processed');
    });
    document.querySelectorAll('.avatar[data-arizona-styler-avatar-checked]').forEach(el => {
      el.removeAttribute('data-arizona-styler-avatar-checked');
    });
  }

  
  if (tweaks) {
    if (tweaks.hideFooter) {
      root.setAttribute("data-arizona-styler-hide-footer", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-footer");
    }
    if (tweaks.hideSidebar) {
      root.setAttribute("data-arizona-styler-hide-sidebar", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-sidebar");
    }
    if (tweaks.hideAvatars) {
      root.setAttribute("data-arizona-styler-hide-avatars", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-avatars");
    }
    if (tweaks.hideYourPosts) {
      root.setAttribute("data-arizona-styler-hide-your-posts", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-your-posts");
    }
    if (tweaks.hideNewIndicator) {
      root.setAttribute("data-arizona-styler-hide-new-indicator", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-new-indicator");
    }
    if (tweaks.hideNewThreadIndicator) {
      root.setAttribute("data-arizona-styler-hide-new-thread-indicator", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-new-thread-indicator");
    }
    if (tweaks.hideNodeIcons) {
      root.setAttribute("data-arizona-styler-hide-node-icons", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-node-icons");
    }
    if (tweaks.hideConversations) {
      root.setAttribute("data-arizona-styler-hide-conversations", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-conversations");
    }
    if (tweaks.hideAlerts) {
      root.setAttribute("data-arizona-styler-hide-alerts", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-alerts");
    }
    if (tweaks.hideSubforums) {
      root.setAttribute("data-arizona-styler-hide-subforums", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-subforums");
    }
    if (tweaks.hidePrefixes) {
      root.setAttribute("data-arizona-styler-hide-prefixes", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-prefixes");
    }
    if (tweaks.hideSignatures) {
      root.setAttribute("data-arizona-styler-hide-signatures", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-signatures");
    }
    if (tweaks.hideStyleVariation) {
      root.setAttribute("data-arizona-styler-hide-style-variation", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-style-variation");
    }
    if (tweaks.hideBreadcrumbs) {
      root.setAttribute("data-arizona-styler-hide-breadcrumbs", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-breadcrumbs");
    }
    if (tweaks.hideSectionLinks) {
      root.setAttribute("data-arizona-styler-hide-section-links", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-section-links");
    }
    if (tweaks.hideUserExtras) {
      root.setAttribute("data-arizona-styler-hide-user-extras", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-user-extras");
    }
    if (tweaks.hidePostBg) {
      root.setAttribute("data-arizona-styler-hide-post-bg", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-post-bg");
    }
    if (tweaks.animatedAvatars) {
      root.setAttribute("data-arizona-styler-animated-avatars", "true");
    } else {
      root.removeAttribute("data-arizona-styler-animated-avatars");
    }
    if (tweaks.navSearch && tweaks.navSearch !== "default") {
      root.setAttribute("data-arizona-styler-nav-search", tweaks.navSearch);
    } else {
      root.removeAttribute("data-arizona-styler-nav-search");
    }
    if (tweaks.nodeIconStatus && tweaks.nodeIconStatus !== "default") {
      root.setAttribute("data-arizona-styler-node-icon-status", tweaks.nodeIconStatus);
    } else {
      root.removeAttribute("data-arizona-styler-node-icon-status");
    }
    if (tweaks.hideEcosystemBadges) {
      root.setAttribute("data-arizona-styler-hide-ecosystem-badges", "true");
    } else {
      root.removeAttribute("data-arizona-styler-hide-ecosystem-badges");
    }

    const cursorType = tweaks.cursor || "default";
    const cursorThickness = tweaks.cursorThickness !== undefined ? tweaks.cursorThickness : 2;
    const cursorColorUseTheme = tweaks.cursorColorUseTheme !== undefined ? tweaks.cursorColorUseTheme : true;
    const cursorColor = cursorColorUseTheme ? settings.accent1 : (tweaks.cursorColor || settings.accent1);

    if (cursorType !== "default") {
      applyDynamicCursor(cursorType, cursorColor, cursorThickness);
    } else {
      applyDynamicCursor("default", settings.accent1, 2);
    }
    if (tweaks.ambientEffect && tweaks.ambientEffect !== "none") {
      startAmbientEffect(tweaks.ambientEffect);
    } else {
      stopAmbientEffect();
    }
    applyNavbarHiding(tweaks.hiddenNavIds);
    renderCustomNavItems(tweaks.customNavItems);
  } else {
    root.removeAttribute("data-arizona-styler-hide-footer");
    root.removeAttribute("data-arizona-styler-hide-sidebar");
    root.removeAttribute("data-arizona-styler-hide-avatars");
    root.removeAttribute("data-arizona-styler-hide-your-posts");
    root.removeAttribute("data-arizona-styler-hide-new-indicator");
    root.removeAttribute("data-arizona-styler-hide-node-icons");
    root.removeAttribute("data-arizona-styler-hide-conversations");
    root.removeAttribute("data-arizona-styler-hide-alerts");
    root.removeAttribute("data-arizona-styler-hide-subforums");
    root.removeAttribute("data-arizona-styler-hide-prefixes");
    root.removeAttribute("data-arizona-styler-hide-signatures");
    root.removeAttribute("data-arizona-styler-nav-search");
    root.removeAttribute("data-arizona-styler-node-icon-status");
    applyDynamicCursor("default", settings.accent1, 2);
    stopAmbientEffect();
    applyNavbarHiding([]);
    renderCustomNavItems([]);
  }

  
  syncForumStyleVariation(settings.mode);

  
  const textSecondary = settings.mode === "dark" ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)";
  const textMuted = settings.mode === "dark" ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)";
  const borderOpacity = settings.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const inputBg = settings.mode === "dark" ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.6)";
  const headerBg = settings.block;

  
  root.style.setProperty("--arizona-styler-bg", settings.bg);
  root.style.setProperty("--arizona-styler-block", settings.block);
  root.style.setProperty("--arizona-styler-accent1", settings.accent1);
  root.style.setProperty("--arizona-styler-accent2", settings.accent2);
  root.style.setProperty("--arizona-styler-text", settings.text);
  root.style.setProperty("--arizona-styler-radius", settings.radius + "px");
  root.style.setProperty("--arizona-styler-border", borderOpacity);
  root.style.setProperty("--arizona-styler-input-bg", inputBg);
  root.style.setProperty("--arizona-styler-header-bg", headerBg);
  root.style.setProperty("--arizona-styler-text-secondary", textSecondary);
  root.style.setProperty("--arizona-styler-text-muted", textMuted);

  const glassOpacity = settings.glassOpacity !== undefined ? settings.glassOpacity : 100;
  const glassBlur = settings.glassBlur !== undefined ? settings.glassBlur : 0;
  
  root.style.setProperty("--arizona-styler-block-rgb", hexToRgbChannels(settings.block));
  root.style.setProperty("--arizona-styler-accent1-rgb", hexToRgbChannels(settings.accent1));
  root.style.setProperty("--arizona-styler-accent2-rgb", hexToRgbChannels(settings.accent2));
  root.style.setProperty("--arizona-styler-bg-rgb", hexToRgbChannels(settings.bg));
  root.style.setProperty("--arizona-styler-glass-opacity", glassOpacity / 100);
  root.style.setProperty("--arizona-styler-glass-blur-val", glassBlur + "px");

  let blockBgOverride = "var(--arizona-styler-block)";
  let glassBlurOverride = "0px";

  if (glassOpacity < 100) {
    blockBgOverride = `rgba(var(--arizona-styler-block-rgb), var(--arizona-styler-glass-opacity))`;
    if (glassBlur > 0) {
      glassBlurOverride = `var(--arizona-styler-glass-blur-val)`;
    }
  }

  root.style.setProperty("--arizona-styler-block-bg-override", blockBgOverride);
  root.style.setProperty("--arizona-styler-glass-blur", glassBlurOverride);

  
  if (settings.fontWeight && settings.fontWeight !== "default") {
    root.style.setProperty("--arizona-styler-font-weight", settings.fontWeight);
  } else {
    root.style.removeProperty("--arizona-styler-font-weight");
  }

  
  const bgType = bgSettings.bgType || "color";
  const bgUrl = bgSettings.bgUrl || "";
  const bgOpacity = bgSettings.bgOpacity !== undefined ? bgSettings.bgOpacity : 40;
  
  root.style.setProperty("--arizona-styler-bg-opacity", bgOpacity / 100);

  if (bgType === "image" && bgUrl) {
    root.style.setProperty("--arizona-styler-bg-image", `url("${bgUrl}")`);
    root.style.setProperty("--arizona-styler-bg-override", "transparent");
  } else if (bgType === "video" && bgUrl) {
    root.style.setProperty("--arizona-styler-bg-image", "none");
    root.style.setProperty("--arizona-styler-bg-override", "transparent");
  } else {
    root.style.setProperty("--arizona-styler-bg-image", "none");
    root.style.removeProperty("--arizona-styler-bg-override");
  }

  
  const handleVideoInjection = (src, active) => {
    let videoEl = document.getElementById("arizona-styler-bg-video");
    if (!active) {
      if (videoEl) videoEl.remove();
      return;
    }

    const appendVideo = (parent) => {
      let currentVideo = document.getElementById("arizona-styler-bg-video");
      if (!currentVideo) {
        currentVideo = document.createElement("video");
        currentVideo.id = "arizona-styler-bg-video";
        currentVideo.className = "arizona-styler-video-bg";
        currentVideo.autoplay = true;
        currentVideo.loop = true;
        currentVideo.muted = true;
        currentVideo.playsInline = true;
        currentVideo.setAttribute("playsinline", "");
        currentVideo.setAttribute("muted", "");
        parent.insertBefore(currentVideo, parent.firstChild);
      }
      if (currentVideo.src !== src) {
        currentVideo.src = src;
        currentVideo.load();
        currentVideo.play().catch(err => console.log("[Arizona Styler] Video autoplay blocked/failed:", err));
      }
    };

    const getTargetParent = () => {
      return document.querySelector(".p-pageWrapper") || document.body;
    };

    const targetParent = getTargetParent();
    if (targetParent) {
      appendVideo(targetParent);
    } else {
      const observer = new MutationObserver((mutations, obs) => {
        const checkParent = getTargetParent();
        if (checkParent) {
          appendVideo(checkParent);
          obs.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  };

  handleVideoInjection(bgUrl, bgType === "video" && bgUrl !== "");

  
  function hexToRgbChannels(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    let r = parseInt(hex.substring(0,2), 16);
    let g = parseInt(hex.substring(2,4), 16);
    let b = parseInt(hex.substring(4,6), 16);
    return `${r}, ${g}, ${b}`;
  }

  function hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    
    let r = parseInt(hex.substring(0,2), 16) / 255;
    let g = parseInt(hex.substring(2,4), 16) / 255;
    let b = parseInt(hex.substring(4,6), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100) + '%', l: Math.round(l * 100) + '%' };
  }

  const accent1Hsl = hexToHsl(settings.accent1);
  const accent2Hsl = hexToHsl(settings.accent2);
  const bgHsl = hexToHsl(settings.bg);
  const blockHsl = hexToHsl(settings.block);
  const textHsl = hexToHsl(settings.text);

  
  function getLuminance(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    let r = parseInt(hex.substring(0,2), 16) / 255;
    let g = parseInt(hex.substring(2,4), 16) / 255;
    let b = parseInt(hex.substring(4,6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  
  let nodeUnreadBg = settings.accent1;
  let nodeUnreadIcon = "#ffffff";

  const acc1Luminance = getLuminance(settings.accent1);
  const acc2Luminance = getLuminance(settings.accent2);
  const avgLuminance = (acc1Luminance + acc2Luminance) / 2;

  const dynamicAccentText = avgLuminance > 0.45 ? "#09090c" : "#ffffff";

  root.style.setProperty("--arizona-styler-accent-text", dynamicAccentText);

  root.style.setProperty("--arizona-styler-node-unread-bg", nodeUnreadBg);
  root.style.setProperty("--arizona-styler-node-unread-icon", nodeUnreadIcon);

  
  const variablesToOverride = [
    
    ['--accent', settings.accent1],
    ['--primary', settings.accent1],
    ['--secondary', settings.accent2],
    ['--link-color', settings.accent1],
    ['--bg-color', settings.bg],
    ['--content-bg', settings.block],
    ['--text-color', settings.text],
    
    
    
    ['--xf-paletteColor1--h', accent1Hsl.h],
    ['--xf-paletteColor1--s', accent1Hsl.s],
    ['--xf-paletteColor1--l', accent1Hsl.l],
    ['--xf-paletteColor1', settings.accent1],

    
    ['--xf-paletteColor3--h', accent2Hsl.h],
    ['--xf-paletteColor3--s', accent2Hsl.s],
    ['--xf-paletteColor3--l', accent2Hsl.l],
    ['--xf-paletteColor3', settings.accent2],

    
    ['--xf-paletteAccent1--h', accent1Hsl.h],
    ['--xf-paletteAccent1--s', accent1Hsl.s],
    ['--xf-paletteAccent1--l', accent1Hsl.l],
    ['--xf-paletteAccent1', settings.accent1],

    
    ['--xf-paletteAccent2--h', accent2Hsl.h],
    ['--xf-paletteAccent2--s', accent2Hsl.s],
    ['--xf-paletteAccent2--l', accent2Hsl.l],
    ['--xf-paletteAccent2', settings.accent2],

    
    ['--xf-pageBg--h', bgHsl.h],
    ['--xf-pageBg--s', bgHsl.s],
    ['--xf-pageBg--l', bgHsl.l],
    ['--xf-pageBg', settings.bg],

    
    ['--xf-paletteNeutral1--h', blockHsl.h],
    ['--xf-paletteNeutral1--s', blockHsl.s],
    ['--xf-paletteNeutral1--l', blockHsl.l],
    ['--xf-paletteNeutral1', settings.block],
    
    
    ['--xf-paletteColor5--h', blockHsl.h],
    ['--xf-paletteColor5--s', blockHsl.s],
    ['--xf-paletteColor5--l', blockHsl.l],

    
    ['--xf-paletteNeutral3--h', textHsl.h],
    ['--xf-paletteNeutral3--s', textHsl.s],
    ['--xf-paletteNeutral3--l', textHsl.l],
    ['--xf-paletteNeutral3', settings.text],

    
    ['--xf-linkColor--h', accent1Hsl.h],
    ['--xf-linkColor--s', accent1Hsl.s],
    ['--xf-linkColor--l', accent1Hsl.l]
  ];

  variablesToOverride.forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  if (settings.font && settings.font !== "default") {
    root.style.setProperty("--arizona-styler-font", settings.font);
    loadGoogleFont(settings.font);
  } else {
    root.style.removeProperty("--arizona-styler-font");
  }

  if (settings.fontSize && settings.fontSize !== "default") {
    root.style.setProperty("--arizona-styler-font-size", settings.fontSize);
  } else {
    root.style.removeProperty("--arizona-styler-font-size");
  }

  
  const updateLogoUrl = () => {
    const logoImg = document.querySelector(".p-header-logo img");
    if (logoImg) {
      const logoSrc = logoImg.getAttribute("src");
      if (logoSrc) {
        root.style.setProperty("--arizona-styler-logo-url", `url("${logoSrc}")`);
      }
    }
  };
  updateLogoUrl();

  const logoObserver = new MutationObserver((mutations, obs) => {
    const logoImg = document.querySelector(".p-header-logo img");
    if (logoImg) {
      const logoSrc = logoImg.getAttribute("src");
      if (logoSrc) {
        root.style.setProperty("--arizona-styler-logo-url", `url("${logoSrc}")`);
        obs.disconnect();
      }
    }
  });
  logoObserver.observe(document.documentElement, { childList: true, subtree: true });

  
  injectDeveloperBadges();
  updateUserColorsAndBanners();
  updateAnimatedAvatars();
}


function loadGoogleFont(fontFamily) {
  if (!fontFamily || fontFamily === "default" || fontFamily.includes("system-ui")) return;

  
  const match = fontFamily.match(/'([^']+)'/);
  const fontName = match ? match[1] : fontFamily.split(',')[0].trim();
  const fontId = `arizona-styler-font-${fontName.toLowerCase().replace(/\s+/g, '-')}`;

  if (document.getElementById(fontId)) return;

  const fontLink = document.createElement("link");
  fontLink.id = fontId;
  fontLink.rel = "stylesheet";
  fontLink.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;

  
  if (document.head) {
    document.head.appendChild(fontLink);
  } else {
    
    const observer = new MutationObserver((mutations, obs) => {
      if (document.head) {
        document.head.appendChild(fontLink);
        obs.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
}


let switchingVariation = false;


function syncForumStyleVariation(mode) {
  const targetVariation = mode === "light" ? "alternate" : "default";
  
  const performSync = () => {
    
    const toggleLink = document.querySelector(`a[href*="misc/style-variation"][href*="variation=${targetVariation}"], a[data-xf-click="style-variation"][data-variation="${targetVariation}"]`);
    
    if (toggleLink) {
      console.log(`[Arizona Styler] Found native variation toggle link for ${targetVariation}. Clicking it.`);
      if (switchingVariation) {
        console.log("[Arizona Styler] Switch already in progress, skipping click.");
        return;
      }
      switchingVariation = true;
      
      
      toggleLink.click();
      return;
    }
    
    
    const currentVariation = document.documentElement.getAttribute("data-style-variation");
    if (currentVariation && currentVariation !== targetVariation) {
      console.log(`[Arizona Styler] Mismatch attribute detected (${currentVariation} vs ${targetVariation}). Trying API fetch...`);
      
      const csrfToken = document.documentElement.getAttribute("data-csrf") || 
                        document.querySelector('input[name="_xfToken"]')?.value ||
                        document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
                        
      if (csrfToken) {
        if (switchingVariation) {
          return;
        }
        switchingVariation = true;
        
        const formData = new FormData();
        formData.append("variation", targetVariation);
        formData.append("_xfResponseType", "json");
        formData.append("_xfWithData", "1");
        formData.append("_xfRequestUri", window.location.pathname + window.location.search);
        formData.append("_xfToken", csrfToken);
        
        fetch("/index.php?misc/style-variation", {
          method: "POST",
          body: formData,
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        })
        .then(() => {
          switchingVariation = false;
          window.location.reload();
        })
        .catch(err => {
          switchingVariation = false;
          console.error("[Arizona Styler] Fallback fetch switch failed:", err);
        });
      }
    }
  };
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", performSync);
  } else {
    performSync();
  }
}


function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function fetchEcosystemApi() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'FETCH_ECOSYSTEM_API' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response ? response.error : 'Unknown error fetching API via background'));
      }
    });
  });
}

function resetBadges() {
  const activeBadges = document.querySelectorAll('.arizona-styler-dev-badge');
  activeBadges.forEach(b => b.remove());
  
  document.querySelectorAll('[data-arizona-ecosystem-badge-checked]').forEach(el => {
    let hasBadgesLeft = false;
    let sibling = el.nextSibling;
    while (sibling) {
      if (sibling.nodeType === 1 && sibling.classList.contains('arizona-ecosystem-badge')) {
        hasBadgesLeft = true;
        break;
      }
      sibling = sibling.nextSibling;
    }
    if (!hasBadgesLeft) {
      el.removeAttribute('data-arizona-ecosystem-badge-checked');
      el.removeAttribute('data-arizona-ecosystem-badged');
    }
  });
}

function initEcosystemApi() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }

  chrome.storage.local.get(['arizona_ecosystem_api_data'], async (result) => {
    const cached = result.arizona_ecosystem_api_data;
    const now = Date.now();
    const CACHE_DURATION = 3600000;

    if (cached && cached.data && Array.isArray(cached.data.users)) {
      ecosystemApiData = cached.data.users;
      runIncrementalUpdates();

      if (now - cached.timestamp > CACHE_DURATION) {
        try {
          const freshData = await fetchEcosystemApi();
          chrome.storage.local.set({
            arizona_ecosystem_api_data: {
              timestamp: now,
              data: freshData
            }
          });
          ecosystemApiData = freshData.users;
          resetBadges();
          runIncrementalUpdates();
        } catch (err) {
          console.error('[Arizona Styler] Background revalidation failed:', err);
        }
      }
    } else {
      try {
        const freshData = await fetchEcosystemApi();
        chrome.storage.local.set({
          arizona_ecosystem_api_data: {
            timestamp: now,
            data: freshData
          }
        });
        ecosystemApiData = freshData.users;
        runIncrementalUpdates();
      } catch (err) {
        console.error('[Arizona Styler] Initial fetch failed:', err);
        ecosystemApiData = [];
      }
    }
  });
}

function injectDeveloperBadges() {
  const root = document.documentElement;
  const enabled = root.getAttribute("data-arizona-styler-enabled") === "true";
  const hideEcosystem = root.getAttribute("data-arizona-styler-hide-ecosystem-badges") === "true";

  if (!enabled || hideEcosystem) {
    resetBadges();
    return;
  }

  if (ecosystemApiData === null) {
    return;
  }

  const selector = '.username, [class*="username"]';
  const candidates = document.querySelectorAll(selector);

  candidates.forEach(el => {
    if (el.querySelector('img') || el.classList.contains('avatar') || el.closest('.avatar') || el.closest('.avatarWrapper')) {
      return;
    }

    let target = el;
    const parentLink = el.closest('a');
    if (parentLink && (parentLink.classList.contains('username') || parentLink.className.includes('username'))) {
      target = parentLink;
    } else {
      let ancestor = el;
      while (ancestor.parentElement && 
             (ancestor.parentElement.classList.contains('username') || 
              ancestor.parentElement.className.includes('username'))) {
        ancestor = ancestor.parentElement;
      }
      target = ancestor;
    }

    if (target.getAttribute('data-arizona-ecosystem-badge-checked') === 'true') {
      return;
    }
    target.setAttribute('data-arizona-ecosystem-badge-checked', 'true');

    if (target.getAttribute('data-arizona-ecosystem-badged') === 'true') {
      return;
    }

    const text = target.textContent.trim();
    const normalizedTarget = normalizeName(text);

    const apiUser = ecosystemApiData.find(u => {
      return Array.isArray(u.alternative_nicknames) && u.alternative_nicknames.some(nick => normalizeName(nick) === normalizedTarget);
    });

    if (apiUser) {
      target.setAttribute('data-arizona-ecosystem-badged', 'true');

      const badge = document.createElement('span');
      badge.className = 'arizona-styler-dev-badge arizona-ecosystem-badge';
      const mainTitle = `${apiUser.icon_description}\n(ArizonaAI Ecosystem, добавлено расширением Arizona Forum Styler)`;
      badge.setAttribute('title', mainTitle);
      
      const innerSpan = target.querySelector('span');
      const color = window.getComputedStyle(innerSpan || target).color;
      badge.style.color = color;

      const icon = document.createElement('i');
      icon.className = 'dev-badge-icon';
      
      const iconName = apiUser.icon ? apiUser.icon.replace(/^fa-/, '') : 'code';
      const maskUrl = `url('https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.3/svgs/solid/${iconName}.svg')`;
      icon.style.setProperty('-webkit-mask-image', maskUrl, 'important');
      icon.style.setProperty('mask-image', maskUrl, 'important');
      badge.appendChild(icon);
      
      let lastNode = badge;
      target.parentNode.insertBefore(badge, target.nextSibling);

      if (apiUser.achievements) {
        Object.values(apiUser.achievements).forEach(ach => {
          const achBadge = document.createElement('span');
          achBadge.className = 'arizona-styler-dev-badge arizona-styler-achievement-badge arizona-ecosystem-badge';
          
          if (ach.description) {
            const achTitle = `${ach.name}\n${ach.description}\n(ArizonaAI Ecosystem, добавлено расширением Arizona Forum Styler)`;
            achBadge.setAttribute('title', achTitle);
          } else {
            const achTitle = `${ach.name}\n(ArizonaAI Ecosystem, добавлено расширением Arizona Forum Styler)`;
            achBadge.setAttribute('title', achTitle);
          }
          
          achBadge.style.color = color;
          
          const achIcon = document.createElement('i');
          achIcon.className = 'dev-badge-icon';
          
          const achIconName = ach.icon ? ach.icon.replace(/^fa-/, '') : 'rocket';
          const achMaskUrl = `url('https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.3/svgs/solid/${achIconName}.svg')`;
          achIcon.style.setProperty('-webkit-mask-image', achMaskUrl, 'important');
          achIcon.style.setProperty('mask-image', achMaskUrl, 'important');
          achBadge.appendChild(achIcon);
          
          lastNode.parentNode.insertBefore(achBadge, lastNode.nextSibling);
          lastNode = achBadge;
        });
      }
    }
  });
}

function parseColorToRgb(colorStr) {
  if (!colorStr) return null;
  
  const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }
  
  const hexMatch = colorStr.match(/#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16)
    };
  }
  
  const shortHexMatch = colorStr.match(/#([a-f\d])([a-f\d])([a-f\d])/i);
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16)
    };
  }
  
  return null;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function getColorFilter(colorStr) {
  const rgb = parseColorToRgb(colorStr);
  if (!rgb) return "";
  
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hueRotate = (hsl.h - 38 + 360) % 360;
  const saturate = Math.min(Math.max(hsl.s * 1.5, 0), 300);
  const brightness = Math.min(Math.max(hsl.l / 50 * 100, 30), 200);
  
  return `sepia(1) hue-rotate(${hueRotate}deg) saturate(${saturate}%) brightness(${brightness}%)`;
}

function injectBannedUserIcons() {
  const root = document.documentElement;
  const enabled = root.getAttribute("data-arizona-styler-enabled") === "true";
  const bannedStyle = root.getAttribute("data-arizona-styler-banned-style");

  if (!enabled || bannedStyle !== "icon") {
    document.querySelectorAll('.arizona-styler-banned-icon').forEach(el => el.remove());
    return;
  }

  const bannedElements = document.querySelectorAll('.username--banned');
  bannedElements.forEach(el => {
    const parentLink = el.closest('a') || el;
    if (parentLink.parentNode.querySelector('.arizona-styler-banned-icon')) return;

    const icon = document.createElement('span');
    icon.className = 'arizona-styler-banned-icon';
    icon.setAttribute('title', 'Пользователь заблокирован на форуме, в связи с наличием предупреждений\n(Добавлено расширением Arizona Forum Styler)');

    const i = document.createElement('i');
    i.className = 'banned-icon-svg';
    icon.appendChild(i);

    parentLink.parentNode.insertBefore(icon, parentLink.nextSibling);
  });
}

function updateUserColorsAndBanners() {
  const root = document.documentElement;
  const enabled = root.getAttribute("data-arizona-styler-enabled") === "true";
  
  if (!enabled) {
    document.querySelectorAll('.avatar[data-arizona-styler-paint-processed="true"]').forEach(el => {
      el.style.removeProperty('--avatar-paint-color');
      el.removeAttribute('data-arizona-styler-paint-processed');
    });
    document.querySelectorAll('.userBanner[data-arizona-styler-banner-processed="true"]').forEach(el => {
      el.style.removeProperty('--user-banner-filter');
      el.removeAttribute('data-arizona-styler-banner-processed');
    });
    document.querySelectorAll('.avatar[data-arizona-styler-avatar-checked]').forEach(el => {
      el.removeAttribute('data-arizona-styler-avatar-checked');
    });
    return;
  }

  const avatarStyle = root.getAttribute("data-arizona-styler-avatar-style");
  const removePaints = root.getAttribute("data-arizona-styler-remove-user-paints") === "true";

  const bannedStyle = root.getAttribute("data-arizona-styler-banned-style");
  const needAvatarPaint = (avatarStyle === "paint-accent" || avatarStyle === "paint-glow" || bannedStyle === "red-paint");
  const needBannerPaint = removePaints;

  if (!needAvatarPaint) {
    document.querySelectorAll('.avatar[data-arizona-styler-paint-processed="true"]').forEach(el => {
      el.style.removeProperty('--avatar-paint-color');
      el.removeAttribute('data-arizona-styler-paint-processed');
    });
    document.querySelectorAll('.avatar[data-arizona-styler-avatar-checked]').forEach(el => {
      el.removeAttribute('data-arizona-styler-avatar-checked');
    });
  }

  if (!needBannerPaint) {
    document.querySelectorAll('.userBanner[data-arizona-styler-banner-processed="true"]').forEach(el => {
      el.style.removeProperty('--user-banner-filter');
      el.removeAttribute('data-arizona-styler-banner-processed');
    });
  }

  if (!needAvatarPaint && !needBannerPaint) {
    return;
  }

  const hasPaintOverride = root.hasAttribute("data-arizona-styler-remove-user-paints");
  if (hasPaintOverride) {
    root.removeAttribute("data-arizona-styler-remove-user-paints");
  }

  function getUsernameColor(usernameEl) {
    if (!usernameEl) return null;
    const coloredEl = usernameEl.querySelector('[class*="username--style"], [style*="color"], span, strong, b') || usernameEl;
    const color = window.getComputedStyle(coloredEl).color;
    return color;
  }

  function findUsernameEl(targetEl) {
    if (!targetEl) return null;

    const container = targetEl.closest('.message, .structItem, .memberHeader, .memberTooltip, .tooltip, .menu, .p-navgroup-link--user, .p-account');
    if (container) {
      if (container.classList.contains('structItem')) {
        if (targetEl.closest('.structItem-cell--iconEnd, .structItem-cell--latest')) {
          const latestCell = container.querySelector('.structItem-cell--latest');
          if (latestCell) {
            const u = latestCell.querySelector('.username, [class*="username"]');
            if (u) return u;
          }
        }
        const mainCell = container.querySelector('.structItem-cell--main, .structItem-cell--icon');
        if (mainCell) {
          const u = mainCell.querySelector('.username, [class*="username"]');
          if (u) return u;
        }
      }

      const localUsername = container.querySelector('.username, [class*="username"]');
      if (localUsername && !targetEl.contains(localUsername)) {
        return localUsername;
      }
    }

    const userId = targetEl.getAttribute('data-user-id') || targetEl.closest('[data-user-id]')?.getAttribute('data-user-id');
    if (userId) {
      const userMatch = document.querySelector(`.username[data-user-id="${userId}"], a.username[href*="${userId}"], a[href*="/members/${userId}"] .username, [class*="username"][data-user-id="${userId}"]`);
      if (userMatch) return userMatch;
    }

    const href = targetEl.getAttribute('href') || targetEl.closest('a')?.getAttribute('href');
    if (href && href.includes('/members/')) {
      const cleanHref = href.split('?')[0].split('#')[0];
      const hrefMatch = document.querySelector(`a.username[href*="${cleanHref}"], a[href*="${cleanHref}"] .username`);
      if (hrefMatch) return hrefMatch;
    }

    const currentUserEl = document.querySelector('.p-navgroup-link--user .username, .p-navgroup-link--user [class*="username"], .p-navgroup-link--user .p-navgroup-linkText, .p-account .username');
    if (currentUserEl) return currentUserEl;

    return null;
  }

  if (needAvatarPaint) {
    const bannedStyle = root.getAttribute("data-arizona-styler-banned-style");
    const avatars = document.querySelectorAll('.avatar');
    avatars.forEach(avatarEl => {
      if (avatarEl.getAttribute('data-arizona-styler-avatar-checked') === 'true') {
        return;
      }
      avatarEl.setAttribute('data-arizona-styler-avatar-checked', 'true');

      const usernameEl = findUsernameEl(avatarEl);
      if (usernameEl) {
        let color = getUsernameColor(usernameEl);
        if (usernameEl.querySelector('.username--banned') && bannedStyle === 'red-paint') {
          color = '#ff4d4d';
        }
        if (color) {
          avatarEl.style.setProperty('--avatar-paint-color', color);
          avatarEl.setAttribute('data-arizona-styler-paint-processed', 'true');
        }
      }
    });
  }

  const banners = document.querySelectorAll('.userBanner');
  banners.forEach(bannerEl => {
    const usernameEl = findUsernameEl(bannerEl);
    if (usernameEl) {
      const isBanned = usernameEl.querySelector('.username--banned') !== null || usernameEl.classList.contains('username--banned');
      if (isBanned) {
        bannerEl.style.setProperty('display', 'none', 'important');
        return;
      }

      if (needBannerPaint) {
        const color = getUsernameColor(usernameEl);
        if (color) {
          const filterStr = getColorFilter(color);
          if (filterStr) {
            bannerEl.style.setProperty('--user-banner-filter', filterStr);
            bannerEl.setAttribute('data-arizona-styler-banner-processed', 'true');
          }
        }
      }
    }
  });

  if (hasPaintOverride) {
    root.setAttribute("data-arizona-styler-remove-user-paints", "true");
  }
}

let updateRequested = false;
let pageMutationObserver = null;

function observePageMutations() {
  if (pageMutationObserver) {
    pageMutationObserver.disconnect();
  }

  pageMutationObserver = new MutationObserver((mutations) => {
    if (!chrome.runtime || !chrome.runtime.id) {
      pageMutationObserver.disconnect();
      return;
    }

    let hasAddedNodes = false;
    for (let i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) {
        hasAddedNodes = true;
        break;
      }
    }

    if (hasAddedNodes) {
      if (!updateRequested) {
        updateRequested = true;
        requestAnimationFrame(() => {
          updateRequested = false;
          if (!chrome.runtime || !chrome.runtime.id) return;
          runIncrementalUpdates();
        });
      }
    }
  });

  pageMutationObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

function checkAndInjectCopySelectionLink() {
  if (!activeEnabled || !activeTweaks || !activeTweaks.copySelectedTextLink) return;

  const tooltip = document.querySelector('.tooltip--selectToQuote');
  if (!tooltip) return;

  if (tooltip.querySelector('.arizona-styler-copy-link-btn')) return;

  const container = tooltip.querySelector('.buttonGroup') || tooltip.querySelector('.tooltip-content-inner') || tooltip.querySelector('.tooltip-content');
  if (!container) return;

  const replyBtn = tooltip.querySelector('.js-replyClick') || Array.from(tooltip.querySelectorAll('a, button')).find(el => el.textContent.includes('Ответить'));

  const copyBtn = document.createElement('a');
  copyBtn.className = 'button button--link arizona-styler-copy-link-btn';
  copyBtn.href = '#';
  copyBtn.style.cursor = 'pointer';
  copyBtn.title = 'Скопировать ссылку на выделенный текст';
  copyBtn.innerHTML = '<span class="button-text">Ссылка</span>';

  const copyToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    } else {
      return new Promise((resolve, reject) => {
        try {
          const el = document.createElement('textarea');
          el.value = text;
          el.setAttribute('readonly', '');
          el.style.position = 'absolute';
          el.style.left = '-9999px';
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }
  };

  copyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    let postId = '';
    let postUrl = new URL(window.location.href);

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let ancestor = range.commonAncestorContainer;
      if (ancestor.nodeType === Node.TEXT_NODE) {
        ancestor = ancestor.parentElement;
      }
      const postEl = ancestor.closest('.message--post, .js-post, article.message');
      if (postEl) {
        const contentAttr = postEl.getAttribute('data-content');
        if (contentAttr && contentAttr.startsWith('post-')) {
          postId = contentAttr.replace('post-', '');
        } else {
          const idAttr = postEl.getAttribute('id');
          const match = idAttr && idAttr.match(/post-(\d+)/);
          if (match) {
            postId = match[1];
          }
        }

        const shareLink = postEl.querySelector('.message-attribution-opposite a[href*="post-"], .message-attribution-main a[href*="post-"]');
        if (shareLink && shareLink.href) {
          try {
            postUrl = new URL(shareLink.href);
          } catch(err) {}
        }
      }
    }

    postUrl.hash = '';
    
    const cleanText = selectedText.replace(/\s+/g, ' ');
    
    let finalUrl = '';
    if (postId) {
      finalUrl = `${postUrl.origin}${postUrl.pathname}${postUrl.search}#post-${postId}:~:text=${encodeURIComponent(cleanText)}`;
    } else {
      finalUrl = `${postUrl.origin}${postUrl.pathname}${postUrl.search}:~:text=${encodeURIComponent(cleanText)}`;
    }

    copyToClipboard(finalUrl).then(() => {
      const btnText = copyBtn.querySelector('.button-text') || copyBtn;
      const originalText = btnText.textContent;
      btnText.textContent = 'Скопировано!';
      copyBtn.classList.add('is-copied');
      
      setTimeout(() => {
        btnText.textContent = originalText;
        copyBtn.classList.remove('is-copied');
      }, 1500);
    }).catch(err => {
      console.error('[Arizona Styler] Failed to copy link:', err);
    });
  });

  if (replyBtn) {
    replyBtn.parentNode.insertBefore(copyBtn, replyBtn.nextSibling);
  } else {
    container.appendChild(copyBtn);
  }
}

function runIncrementalUpdates() {
  injectDeveloperBadges();
  updateUserColorsAndBanners();
  updateAnimatedAvatars();
  checkAndInjectCopySelectionLink();
  injectBannedUserIcons();
  
  if (activeEnabled && activeTweaks) {
    const navList = document.querySelector(".p-nav-list.js-offCanvasNavSource");
    if (navList && !navList.hasAttribute("data-arizona-styler-navbar-processed")) {
      applyNavbarHiding(activeTweaks.hiddenNavIds);
      renderCustomNavItems(activeTweaks.customNavItems);
      navList.setAttribute("data-arizona-styler-navbar-processed", "true");
    }
  }
}

function initNavbarLogic() {
  if (!chrome.runtime || !chrome.runtime.id) return;
  parseNavbarButtons();
  if (activeEnabled && activeTweaks) {
    const navList = document.querySelector(".p-nav-list.js-offCanvasNavSource");
    if (navList) {
      applyNavbarHiding(activeTweaks.hiddenNavIds);
      renderCustomNavItems(activeTweaks.customNavItems);
      navList.setAttribute("data-arizona-styler-navbar-processed", "true");
    }
  }
}

initEcosystemApi();

if (document.readyState === "loading") {
  observePageMutations();
  document.addEventListener("DOMContentLoaded", () => {
    captureOriginalFont();
    runIncrementalUpdates();
    initNavbarLogic();
  });
} else {
  captureOriginalFont();
  runIncrementalUpdates();
  initNavbarLogic();
  observePageMutations();
}

window.addEventListener("load", () => {
  captureOriginalFont();
});

setTimeout(() => {
  captureOriginalFont();
}, 1000);




let ambientCanvas = null;
let ambientCtx = null;
let ambientAnimationId = null;
let ambientParticles = [];
let activeAmbientType = "none";

function startAmbientEffect(type) {
  if (activeAmbientType === type) return; 
  stopAmbientEffect();
  activeAmbientType = type;

  const appendCanvas = (parent) => {
    let canvas = document.getElementById("arizona-styler-ambient");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "arizona-styler-ambient";
      canvas.className = "arizona-styler-ambient-canvas";
      parent.insertBefore(canvas, parent.firstChild);
    }
    ambientCanvas = canvas;
    ambientCtx = ambientCanvas.getContext("2d");
    
    resizeAmbientCanvas();
    window.addEventListener("resize", resizeAmbientCanvas);

    
    ambientParticles = [];
    let count = 80;
    if (type === "dust") count = 40;
    else if (type === "fireflies") count = 35;
    else if (type === "stars") count = 130;
    else if (type === "rain") count = 100;
    else if (type === "matrix") count = 75;

    for (let i = 0; i < count; i++) {
      ambientParticles.push(createAmbientParticle(type, false));
    }

    animateAmbient();
  };

  if (document.body) {
    appendCanvas(document.body);
  } else {
    const observer = new MutationObserver((mutations, obs) => {
      if (document.body) {
        appendCanvas(document.body);
        obs.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
}

function stopAmbientEffect() {
  if (ambientAnimationId) {
    cancelAnimationFrame(ambientAnimationId);
    ambientAnimationId = null;
  }
  window.removeEventListener("resize", resizeAmbientCanvas);
  const canvas = document.getElementById("arizona-styler-ambient");
  if (canvas) canvas.remove();
  ambientCanvas = null;
  ambientCtx = null;
  activeAmbientType = "none";
}

function resizeAmbientCanvas() {
  if (ambientCanvas) {
    const w = window.innerWidth || document.documentElement.clientWidth || 1024;
    const h = window.innerHeight || document.documentElement.clientHeight || 768;
    if (ambientCanvas.width !== w || ambientCanvas.height !== h) {
      ambientCanvas.width = w;
      ambientCanvas.height = h;
    }
  }
}

function createAmbientParticle(type, reinit = false) {
  const w = window.innerWidth || 1000;
  const h = window.innerHeight || 800;
  
  if (type === "snow") {
    return {
      x: Math.random() * w,
      y: reinit ? -10 : Math.random() * h,
      vx: Math.random() * 1 - 0.5,
      vy: Math.random() * 1.2 + 0.4,
      radius: Math.random() * 2.2 + 0.6,
      opacity: Math.random() * 0.5 + 0.1,
      color: "#ffffff"
    };
  } else if (type === "particles") {
    return {
      x: Math.random() * w,
      y: reinit ? h + 10 : Math.random() * h,
      vx: Math.random() * 0.4 - 0.2,
      vy: -(Math.random() * 0.4 + 0.1),
      radius: Math.random() * 2.2 + 0.6,
      opacity: Math.random() * 0.5 + 0.1,
      color: "accent"
    };
  } else if (type === "dust") {
    return {
      x: Math.random() * w,
      y: reinit ? h + 10 : Math.random() * h,
      vx: Math.random() * 0.4 - 0.2,
      vy: -(Math.random() * 0.4 + 0.1),
      radius: Math.random() * 18 + 6,
      opacity: Math.random() * 0.5 + 0.1,
      fadeSpeed: Math.random() * 0.003 + 0.001,
      color: "accent"
    };
  } else if (type === "rain") {
    return {
      x: Math.random() * w,
      y: reinit ? -20 : Math.random() * h,
      vx: -1.5,
      vy: Math.random() * 6 + 8,
      length: Math.random() * 15 + 10,
      opacity: Math.random() * 0.2 + 0.08,
      color: "#a5b4fc"
    };
  } else if (type === "matrix") {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-*/=<>[]";
    return {
      x: Math.random() * w,
      y: reinit ? -20 : Math.random() * h,
      vy: Math.random() * 3 + 2,
      char: chars[Math.floor(Math.random() * chars.length)],
      opacity: Math.random() * 0.5 + 0.2,
      fontSize: Math.floor(Math.random() * 6) + 10,
      color: "accent"
    };
  } else if (type === "stars") {
    return {
      x: (Math.random() - 0.5) * w,
      y: (Math.random() - 0.5) * h,
      z: reinit ? 1000 : Math.random() * 1000,
      color: "#ffffff"
    };
  } else if (type === "fireflies") {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.1,
      radius: Math.random() * 3 + 1.5,
      opacity: Math.random() * 0.6 + 0.2,
      fadeDir: Math.random() > 0.5 ? 1 : -1,
      color: "#a3e635"
    };
  }
  return {};
}

function animateAmbient() {
  if (!ambientCtx || !ambientCanvas) return;
  if (ambientCanvas.width === 0 || ambientCanvas.height === 0) {
    resizeAmbientCanvas();
  }
  ambientCtx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);

  const accent1 = currentAccent1;
  const accent2 = currentAccent2;
  const w = ambientCanvas.width;
  const h = ambientCanvas.height;

  ambientParticles.forEach((p, idx) => {
    if (activeAmbientType === "snow" || activeAmbientType === "particles") {
      p.x += p.vx;
      p.y += p.vy;

      ambientCtx.beginPath();
      ambientCtx.fillStyle = p.color === "accent" ? (idx % 2 === 0 ? accent1 : accent2) : p.color;
      ambientCtx.globalAlpha = p.opacity;
      ambientCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ambientCtx.fill();
      ambientCtx.globalAlpha = 1.0;

      if (activeAmbientType === "snow") {
        if (p.y > h + 10 || p.x < -10 || p.x > w + 10) {
          ambientParticles[idx] = createAmbientParticle("snow", true);
        }
      } else {
        if (p.y < -10 || p.x < -10 || p.x > w + 10) {
          ambientParticles[idx] = createAmbientParticle("particles", true);
        }
      }
    } else if (activeAmbientType === "dust") {
      p.x += p.vx;
      p.y += p.vy;
      p.opacity -= p.fadeSpeed;
      if (p.opacity <= 0) {
        ambientParticles[idx] = createAmbientParticle("dust", true);
        p = ambientParticles[idx];
      }
      ambientCtx.beginPath();
      const grad = ambientCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      const color = idx % 2 === 0 ? accent1 : accent2;
      grad.addColorStop(0, hexToRgba(color, p.opacity));
      grad.addColorStop(1, hexToRgba(color, 0));
      ambientCtx.fillStyle = grad;
      ambientCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ambientCtx.fill();
    } else if (activeAmbientType === "rain") {
      p.x += p.vx;
      p.y += p.vy;

      ambientCtx.beginPath();
      ambientCtx.strokeStyle = p.color;
      ambientCtx.globalAlpha = p.opacity;
      ambientCtx.lineWidth = 1.5;
      ambientCtx.moveTo(p.x, p.y);
      ambientCtx.lineTo(p.x + p.vx * 1.5, p.y + p.length);
      ambientCtx.stroke();
      ambientCtx.globalAlpha = 1.0;

      if (p.y > h + 20 || p.x < -20) {
        ambientParticles[idx] = createAmbientParticle("rain", true);
      }
    } else if (activeAmbientType === "matrix") {
      p.y += p.vy;

      if (Math.random() > 0.95) {
        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-*/=<>[]";
        p.char = chars[Math.floor(Math.random() * chars.length)];
      }

      ambientCtx.beginPath();
      const color = p.color === "accent" ? (idx % 2 === 0 ? accent1 : accent2) : p.color;
      ambientCtx.fillStyle = color;
      ambientCtx.globalAlpha = p.opacity;
      ambientCtx.font = `${p.fontSize}px monospace`;
      ambientCtx.fillText(p.char, p.x, p.y);
      ambientCtx.globalAlpha = 1.0;

      if (p.y > h + 20) {
        ambientParticles[idx] = createAmbientParticle("matrix", true);
      }
    } else if (activeAmbientType === "stars") {
      p.z -= 4;
      if (p.z <= 0) {
        ambientParticles[idx] = createAmbientParticle("stars", true);
        p = ambientParticles[idx];
      }

      const px = (p.x / p.z) * w + w / 2;
      const py = (p.y / p.z) * h + h / 2;
      const radius = (1 - p.z / 1000) * 2.2;
      const opacity = 1 - p.z / 1000;

      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        ambientCtx.beginPath();
        ambientCtx.fillStyle = p.color;
        ambientCtx.globalAlpha = opacity;
        ambientCtx.arc(px, py, radius, 0, Math.PI * 2);
        ambientCtx.fill();
        ambientCtx.globalAlpha = 1.0;
      } else {
        ambientParticles[idx] = createAmbientParticle("stars", true);
      }
    } else if (activeAmbientType === "fireflies") {
      p.opacity += p.fadeDir * 0.01;
      if (p.opacity >= 0.8) {
        p.fadeDir = -1;
      } else if (p.opacity <= 0.1) {
        p.fadeDir = 1;
      }

      p.angle += (Math.random() * 0.2 - 0.1);
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;

      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      ambientCtx.beginPath();
      const grad = ambientCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2);
      const color = idx % 2 === 0 ? accent1 : "#a3e635";
      grad.addColorStop(0, hexToRgba(color, p.opacity));
      grad.addColorStop(0.4, hexToRgba(color, p.opacity * 0.4));
      grad.addColorStop(1, hexToRgba(color, 0));
      
      ambientCtx.fillStyle = grad;
      ambientCtx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
      ambientCtx.fill();
    }
  });

  ambientAnimationId = requestAnimationFrame(animateAmbient);
}

function hexToRgba(hex, alpha) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  let r = parseInt(hex.substring(0,2), 16);
  let g = parseInt(hex.substring(2,4), 16);
  let b = parseInt(hex.substring(4,6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


function applyDynamicCursor(cursorType, accentColor, thickness) {
  const existingStyle = document.getElementById("arizona-styler-dynamic-cursor");
  if (existingStyle) existingStyle.remove();

  if (!cursorType || cursorType === "default") {
    document.documentElement.removeAttribute("data-arizona-styler-cursor");
    return;
  }

  document.documentElement.setAttribute("data-arizona-styler-cursor", cursorType);

  const t = parseFloat(thickness) || 2;
  let svgContent = "";
  let hotX = 0;
  let hotY = 0;

  if (cursorType === "crosshair") {
    const rVal = Math.max(1, t);
    const swVal = t * 0.75;
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="${rVal}" fill="${accentColor}"/><line x1="12" y1="2" x2="12" y2="10" stroke="${accentColor}" stroke-width="${swVal}"/><line x1="12" y1="14" x2="12" y2="22" stroke="${accentColor}" stroke-width="${swVal}"/><line x1="2" y1="12" x2="10" y2="12" stroke="${accentColor}" stroke-width="${swVal}"/><line x1="14" y1="12" x2="22" y2="12" stroke="${accentColor}" stroke-width="${swVal}"/></svg>`;
    hotX = 12;
    hotY = 12;
  } else if (cursorType === "gta") {
    const rVal = Math.max(1, t);
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="8" fill="none" stroke="${accentColor}" stroke-width="${t}"/><circle cx="14" cy="14" r="${rVal}" fill="${accentColor}"/></svg>`;
    hotX = 14;
    hotY = 14;
  } else if (cursorType === "dot") {
    const rVal = Math.max(1.5, t);
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${rVal}" fill="${accentColor}" stroke="#ffffff" stroke-width="1.5"/></svg>`;
    hotX = 8;
    hotY = 8;
  } else if (cursorType === "arrow") {
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4 2v16l4-4 3 6.5 2-1-3-6.5 5 0z" fill="${accentColor}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    hotX = 4;
    hotY = 2;
  } else if (cursorType === "diamond") {
    const rVal = Math.max(1, t - 1);
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="${accentColor}" stroke-width="${t}"/><circle cx="12" cy="12" r="${rVal}" fill="${accentColor}"/></svg>`;
    hotX = 12;
    hotY = 12;
  } else if (cursorType === "ring") {
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="${accentColor}" stroke-width="${t}"/><circle cx="12" cy="12" r="2" fill="#ffffff"/></svg>`;
    hotX = 12;
    hotY = 12;
  } else {
    return;
  }

  const svgBase64 = btoa(svgContent);

  const style = document.createElement("style");
  style.id = "arizona-styler-dynamic-cursor";
  style.innerHTML = `
    html[data-arizona-styler-cursor="${cursorType}"],
    html[data-arizona-styler-cursor="${cursorType}"] * {
      cursor: url('data:image/svg+xml;base64,${svgBase64}') ${hotX} ${hotY}, auto !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function parseNavbarButtons() {
  const navLinks = document.querySelectorAll(".p-nav-list.js-offCanvasNavSource .p-navEl-link");
  const buttons = [];
  const seenIds = new Set();

  navLinks.forEach((link) => {
    const navId = link.getAttribute("data-nav-id");
    const href = link.getAttribute("href");
    const nameSpan = link.querySelector("span");
    const name = nameSpan ? nameSpan.textContent.trim() : link.textContent.trim();
    
    let id = navId || href || name;
    if (!id) return;
    
    id = id.trim();
    if (seenIds.has(id)) return;
    seenIds.add(id);

    buttons.push({
      id: id,
      name: name || id
    });
  });

  if (buttons.length > 0) {
    if (!chrome.runtime || !chrome.runtime.id) return;
    chrome.storage.local.set({ parsedNavbarButtons: buttons }, () => {
      console.log("[Arizona Styler] Saved parsed navbar buttons:", buttons);
    });
  }
}

function applyNavbarHiding(hiddenIds) {
  if (!hiddenIds || !Array.isArray(hiddenIds)) return;
  const hiddenSet = new Set(hiddenIds);

  const navLinks = document.querySelectorAll(".p-nav-list.js-offCanvasNavSource .p-navEl-link");
  navLinks.forEach((link) => {
    const navId = link.getAttribute("data-nav-id");
    const href = link.getAttribute("href");
    const nameSpan = link.querySelector("span");
    const name = nameSpan ? nameSpan.textContent.trim() : link.textContent.trim();
    
    const id = navId || href || name;
    if (id && hiddenSet.has(id.trim())) {
      const li = link.closest("li");
      if (li) {
        li.style.display = "none";
      }
    } else {
      const li = link.closest("li");
      if (li) {
        li.style.removeProperty("display");
      }
    }
  });
}

function renderCustomNavItems(items) {
  document.querySelectorAll(".arizona-styler-custom-nav").forEach(el => el.remove());

  if (!items || !Array.isArray(items) || items.length === 0) return;

  const navList = document.querySelector(".p-nav-list.js-offCanvasNavSource");
  if (!navList) return;

  items.forEach(item => {
    const li = document.createElement("li");
    li.className = "arizona-styler-custom-nav";

    const navEl = document.createElement("div");
    navEl.className = "p-navEl";

    const a = document.createElement("a");
    a.href = item.url;
    a.className = "p-navEl-link";
    if (item.newTab) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }

    const span = document.createElement("span");
    span.textContent = item.name;

    a.appendChild(span);
    navEl.appendChild(a);
    li.appendChild(navEl);
    navList.appendChild(li);
  });
}

function updateAnimatedAvatars() {
  const root = document.documentElement;
  const enabled = root.getAttribute("data-arizona-styler-enabled") === "true";
  const animAvatars = root.getAttribute("data-arizona-styler-animated-avatars") === "true";

  if (!enabled || !animAvatars) {
    document.querySelectorAll('[data-arizona-styler-orig-src]').forEach(el => {
      if (el.tagName === 'IMG') {
        el.src = el.getAttribute('data-arizona-styler-orig-src');
        if (el.hasAttribute('data-arizona-styler-orig-srcset')) {
          el.srcset = el.getAttribute('data-arizona-styler-orig-srcset');
        } else {
          el.removeAttribute('srcset');
        }
      } else {
        el.style.backgroundImage = el.getAttribute('data-arizona-styler-orig-src');
      }
      el.removeAttribute('data-arizona-styler-orig-src');
      el.removeAttribute('data-arizona-styler-orig-srcset');
    });
    document.querySelectorAll('[data-arizona-styler-avatar-anim-checked]').forEach(el => {
      el.removeAttribute('data-arizona-styler-avatar-anim-checked');
    });
    return;
  }

  const elements = document.querySelectorAll('.avatar img, img.avatar, [class*="avatar"] img, .avatar[style*="background-image"]');
  elements.forEach(el => {
    if (el.getAttribute('data-arizona-styler-avatar-anim-checked') === 'true') {
      return;
    }
    el.setAttribute('data-arizona-styler-avatar-anim-checked', 'true');

    let src = '';
    let isImg = el.tagName === 'IMG';
    if (isImg) {
      src = el.src;
    } else {
      src = el.style.backgroundImage;
    }
    
    if (!src) return;
    
    const match = src.match(/\/avatars\/[sml]\//i);
    if (match) {
      if (!el.hasAttribute('data-arizona-styler-orig-src')) {
        el.setAttribute('data-arizona-styler-orig-src', src);
        if (isImg && el.srcset) {
          el.setAttribute('data-arizona-styler-orig-srcset', el.srcset);
        }
      }
      const newSrc = src.replace(/\/avatars\/[sml]\//i, '/avatars/o/');
      if (isImg) {
        el.src = newSrc;
        el.removeAttribute('srcset');
      } else {
        el.style.backgroundImage = newSrc;
      }
    }
  });
}