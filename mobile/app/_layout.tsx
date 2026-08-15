import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts as useDmSans, DMSans_400Regular, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { useFonts as useManrope, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { AppProvider } from "@/providers/app-provider";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { colors } from "../theme";

export default function RootLayout() {
  const [dmLoaded] = useDmSans({ DMSans_400Regular, DMSans_700Bold });
  const [manropeLoaded] = useManrope({ Manrope_700Bold, Manrope_800ExtraBold });
  if (!dmLoaded || !manropeLoaded) return null;
  return <AppProvider><StatusBar style="dark" /><Stack screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.green, headerTitleStyle: { fontFamily: "Manrope_800ExtraBold" }, contentStyle: { backgroundColor: colors.portalCream } }}><Stack.Screen name="(tabs)" options={{ headerShown: false }} /><Stack.Screen name="login" options={{ title: "Sign in" }} /><Stack.Screen name="register" options={{ title: "Create account" }} /><Stack.Screen name="listings/[id]" options={{ title: "Listing details" }} /><Stack.Screen name="account/verify-email" options={{ title: "Verify email" }} /></Stack><AnalyticsConsent /></AppProvider>;
}
