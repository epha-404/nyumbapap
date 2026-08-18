import type { PrivateObjectStorage } from "./provider";
import { NisokoObjectStorage } from "./nisoko-storage";
export function listingImageStorage(): PrivateObjectStorage { return NisokoObjectStorage.fromEnvironment(); }
