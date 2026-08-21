import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/providers/app-provider";
import { MobilePhotoModeration } from "@/components/photo-moderation";
import type { MobileModerationData } from "@/components/moderation-portal";
import { Body, Button, Card, Eyebrow, H1, Screen } from "@/components/ui";

export default function AdminPhotoReviewScreen() {
  const auth = useAuth();
  const isAdmin = auth.session?.role === "ADMIN";
  const query = useQuery({ queryKey: ["moderation", "photos"], queryFn: () => apiJson<MobileModerationData>("moderation/queue"), enabled: isAdmin });
  if (auth.loading) return <Screen><Body muted>Loading administration access…</Body></Screen>;
  if (!auth.session) return <Screen><Eyebrow>Administration</Eyebrow><H1>Sign in required</H1><Button title="Sign in" onPress={() => router.replace("/login")} /></Screen>;
  if (!isAdmin) return <Screen><Eyebrow>Administration</Eyebrow><H1>Admins only</H1><Card><Body muted>Your account cannot review listing photos.</Body></Card><Button secondary title="Back to dashboard" onPress={() => router.back()} /></Screen>;
  return <Screen>
    <Eyebrow>Administration</Eyebrow>
    <H1>Interior photo review</H1>
    <Body muted>Review the protected upload, add optional notes, then approve it for the live listing or reject it.</Body>
    {query.isLoading ? <Body muted>Loading pending photos…</Body> : query.error ? <Card><Body muted>{query.error instanceof Error ? query.error.message : "The photo queue could not be loaded."}</Body></Card> : <MobilePhotoModeration initialPhotos={query.data?.photos ?? []} />}
  </Screen>;
}
