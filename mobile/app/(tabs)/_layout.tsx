import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors, typography } from "../../theme";

const icon = (value: string, color: string) => <Text style={{ color, fontSize: 20 }}>{value}</Text>;
export default function TabLayout() { return <Tabs screenOptions={{ headerStyle: { backgroundColor: colors.white }, headerTintColor: colors.green, headerTitleStyle: { fontFamily: typography.heading }, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 66, paddingBottom: 8, paddingTop: 7, borderTopColor: colors.portalLine, backgroundColor: colors.white }, tabBarLabelStyle: { fontFamily: typography.bodyBold } }}><Tabs.Screen name="index" options={{ title: "Marketplace", tabBarIcon: ({ color }) => icon("⌂", String(color)) }} /><Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color }) => icon("▦", String(color)) }} /><Tabs.Screen name="help" options={{ title: "Help", tabBarIcon: ({ color }) => icon("?", String(color)) }} /></Tabs>; }
