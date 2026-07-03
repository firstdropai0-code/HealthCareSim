export type MediaAssetType = "image" | "video" | "avatar" | "document";

export type MediaAsset = {
  id: string;
  type: MediaAssetType;
  url?: string;
  prompt?: string;
  description?: string;
};

