import { Link, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { AuthForm } from "@/components/auth-form";
import { Body, Card, Eyebrow, H1, Screen } from "@/components/ui";
import { colors, typography } from "../theme";
export default function Register() { const { email } = useLocalSearchParams<{ email?: string }>(); return <Screen><Card><Eyebrow>Join the marketplace</Eyebrow><H1>Create your account</H1><Body muted>Choose an account type, then verify your email with a one-time code.</Body><AuthForm mode="REGISTER" initialEmail={email ?? ""} /><Text style={s.copy}>Already registered? <Link href="/login" style={s.link}>Sign in</Link>.</Text></Card></Screen>; }
const s = StyleSheet.create({ copy: { color: colors.muted, fontFamily: typography.body }, link: { color: colors.green, textDecorationLine: "underline" } });
