import { Alert } from "react-native";
import { router } from "expo-router";
import { ListingForm } from "@/components/listing-form";
import { Body, Eyebrow, H1, Screen } from "@/components/ui";
import { useAuth } from "@/providers/app-provider";

export default function NewListingScreen() {
  const auth = useAuth();
  if (auth.loading) return <Screen><Body muted>Checking your account…</Body></Screen>;
  if (!auth.session) {
    router.replace("/login");
    return null;
  }
  if (auth.session.role !== "LANDLORD" && auth.session.role !== "AGENT") {
    return <Screen><Eyebrow>Listing access</Eyebrow><H1>Landlord or agent account required</H1><Body muted>Your current account cannot create rental listings.</Body></Screen>;
  }
  return <Screen>
    <Eyebrow>Landlord workspace</Eyebrow>
    <H1>List a property</H1>
    <ListingForm
      onCancel={() => router.back()}
      onCreated={() => {
        Alert.alert("Listing submitted", "Your listing is now visible in your dashboard and awaiting moderation.");
        router.replace("/(tabs)/dashboard");
      }}
    />
  </Screen>;
}
