import { Alert } from "react-native";
import { router } from "expo-router";
import { Button } from "./ui";

export const LISTING_CREATE_ROUTE = "/dashboard/listings/new" as const;

export function ListPropertyCta({ navigate = path => router.push(path) }: { navigate?: (path: typeof LISTING_CREATE_ROUTE) => void }) {
  function open() {
    try { navigate(LISTING_CREATE_ROUTE); }
    catch (error) {
      const detail = error instanceof Error ? error.message : "Navigation failed";
      Alert.alert("Could not open listing form", detail);
    }
  }
  return <Button title="List a property" onPress={open} />;
}
