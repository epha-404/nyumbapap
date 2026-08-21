import { router } from "expo-router";
import { Button } from "@/components/ui";

export const ADMIN_PHOTO_REVIEW_ROUTE = "/dashboard/moderation/photos" as const;

export function AdminPhotoReviewCta({ pending, navigate = router.push }: { pending: number; navigate?: (route: typeof ADMIN_PHOTO_REVIEW_ROUTE) => void }) {
  return <Button title={`Review interior photos (${pending})`} onPress={() => navigate(ADMIN_PHOTO_REVIEW_ROUTE)} />;
}
