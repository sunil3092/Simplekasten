import { Platform } from "react-native";
import { getAccessToken } from "./session";
import { API_URL } from "./trpc";

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export function attachmentFileUrl(id: string): string {
  return `${API_URL}/attachments/file/${id}`;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

// The export endpoint (see downloadVaultExport in trpc.ts) is the only other
// binary transfer in this app, and it's a plain authenticated fetch for the
// same reason: multipart uploads don't fit tRPC's JSON request shape.
export async function uploadAttachment(noteId: string, file: PickedFile): Promise<{ id: string; kind: "photo" | "voice" }> {
  const form = new FormData();
  if (Platform.OS === "web") {
    // On web, expo-image-picker/expo-audio hand back a blob: URI, not a real
    // filesystem path — fetch it to get an actual Blob for FormData.
    const blob = await (await fetch(file.uri)).blob();
    form.append("file", blob, file.name);
  } else {
    // React Native's FormData accepts this { uri, name, type } shape for a
    // local file URI in place of a real Blob/File object.
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }

  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/attachments/${noteId}`, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}
