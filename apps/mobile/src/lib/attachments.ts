// Deliberately empty of network code now — attachments live in the local
// vault's attachments/ folder (see @simplekasten/local-engine's
// createAttachment), copied there directly from whatever URI the picker or
// recorder handed back.
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}
