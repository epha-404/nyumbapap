import { Platform } from "react-native";

// Exact values extracted from frontend/styles.css:1, frontend/src/app/portal.module.css:1,
// frontend/src/app/globals.css:3-22, and frontend/src/app/listings/[id]/listing-detail.module.css:1-9.
export const colors = {
  green: "#075b49", green2: "#0b725d", ink: "#16312b", portalInk: "#16352e",
  cream: "#f5f2e9", portalCream: "#f5f1e8", orange: "#f2994a", eyebrow: "#df792b",
  line: "#dce4df", portalLine: "#e4ded1", inputLine: "#c9d2cd", white: "#ffffff",
  muted: "#63736e", portalMuted: "#62736e", dark: "#102e28", paleGreen: "#e3f4ed",
  errorBackground: "#fff0ed", error: "#aa2222", gold: "#f7bd78"
} as const;

export const spacing = { xs: 5, sm: 10, md: 16, lg: 22, xl: 30, xxl: 45, section: 65 } as const;
export const radii = { input: 10, button: 12, card: 16, property: 17, panel: 20, auth: 22, pill: 999 } as const;
export const typography = {
  body: "DMSans_400Regular", bodyBold: "DMSans_700Bold", heading: "Manrope_800ExtraBold", headingRegular: "Manrope_700Bold"
} as const;
export const shadows = {
  card: Platform.select({ ios: { shadowColor: "#10362e", shadowOpacity: 0.12, shadowRadius: 25, shadowOffset: { width: 0, height: 16 } }, android: { elevation: 4 }, default: {} }),
  modal: Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 50, shadowOffset: { width: 0, height: 30 } }, android: { elevation: 12 }, default: {} })
};
