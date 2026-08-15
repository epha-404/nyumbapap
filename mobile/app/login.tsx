import { Link, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { AuthForm } from "@/components/auth-form";
import { Body, Card, Eyebrow, H1, Screen } from "@/components/ui";
import { colors, typography } from "../theme";
export default function Login() { const { email } = useLocalSearchParams<{ email?: string }>(); return <Screen><Card><Eyebrow>Welcome back</Eyebrow><H1>Sign in to NyumbaPap</H1><Body muted>Enter the email address for your existing account. If it is new, we will take you to registration to choose an account type first.</Body><AuthForm mode="LOGIN" initialEmail={email ?? ""} /><Text style={s.copy}>Need an account? <Link href="/register" style={s.link}>Register and choose your account type</Link>.</Text></Card></Screen>; }
const s = StyleSheet.create({ copy: { color: colors.muted, fontFamily: typography.body, lineHeight: 24 }, link: { color: colors.green, textDecorationLine: "underline" } });
