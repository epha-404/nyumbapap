import type { PrivateObjectStorage } from "./provider";
import { NisokoObjectStorage } from "./nisoko-storage";
import { S3PrivateStorage } from "./s3-storage";
export function listingImageStorage(): PrivateObjectStorage { return process.env.NISOKO_STORAGE_API_KEY ? NisokoObjectStorage.fromEnvironment() : S3PrivateStorage.fromEnvironment(); }
