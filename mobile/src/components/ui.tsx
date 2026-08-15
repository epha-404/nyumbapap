import { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { colors, radii, shadows, spacing, typography } from "../../theme";

export function Screen({ children, contentStyle }: PropsWithChildren<{ contentStyle?: ViewStyle }>) { return <SafeAreaView style={s.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.screen, contentStyle]}>{children}</ScrollView></SafeAreaView>; }
export function Eyebrow({ children }: PropsWithChildren) { return <Text style={s.eyebrow}>{children}</Text>; }
export function H1({ children }: PropsWithChildren) { return <Text style={s.h1}>{children}</Text>; }
export function H2({ children }: PropsWithChildren) { return <Text style={s.h2}>{children}</Text>; }
export function Body({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) { return <Text style={[s.body, muted && s.muted]}>{children}</Text>; }
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) { return <View style={[s.card, style]}>{children}</View>; }
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput placeholderTextColor={colors.muted} style={s.input} {...props} /></View>; }
export function Button({ title, onPress, secondary = false, disabled = false, busy = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || busy) && s.disabled, pressed && s.pressed]}>{busy ? <ActivityIndicator color={secondary ? colors.green : colors.white} /> : <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>}</Pressable>; }
export function ErrorText({ message }: { message: string }) { return message ? <Text accessibilityRole="alert" style={s.error}>{message}</Text> : null; }

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.portalCream }, screen: { flexGrow: 1, paddingHorizontal: 18, paddingVertical: 28, gap: spacing.md },
  eyebrow: { color: colors.eyebrow, fontFamily: typography.bodyBold, fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase" },
  h1: { color: colors.portalInk, fontFamily: typography.heading, fontSize: 38, lineHeight: 40, letterSpacing: -1, marginVertical: spacing.xs },
  h2: { color: colors.portalInk, fontFamily: typography.heading, fontSize: 26, lineHeight: 31 }, body: { color: colors.ink, fontFamily: typography.body, fontSize: 15, lineHeight: 24 }, muted: { color: colors.portalMuted },
  card: { backgroundColor: colors.white, borderColor: colors.portalLine, borderWidth: 1, borderRadius: radii.card, padding: spacing.lg, gap: spacing.sm, ...shadows.card },
  field: { gap: 7 }, label: { color: colors.ink, fontFamily: typography.bodyBold, fontSize: 14 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.inputLine, borderRadius: radii.input, paddingHorizontal: 13, color: colors.ink, backgroundColor: colors.white, fontFamily: typography.body },
  button: { minHeight: 48, borderRadius: radii.input, paddingHorizontal: 18, paddingVertical: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.green }, secondary: { backgroundColor: colors.white, borderColor: colors.green, borderWidth: 1 }, buttonText: { color: colors.white, fontFamily: typography.bodyBold }, secondaryText: { color: colors.green }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.82 }, error: { padding: 11, borderRadius: 9, backgroundColor: colors.errorBackground, color: colors.error, fontFamily: typography.body }
});
