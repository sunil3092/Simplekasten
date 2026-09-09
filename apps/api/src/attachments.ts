import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@vaultvista/db";
import type { Express } from "express";
import multer from "multer";
import { verifyAccessToken } from "./auth";

// Files live on local disk rather than S3/R2 (see the schema comment on
// Attachment) — an MVP stand-in. Kept outside src/ so `tsc`'s build never
// touches it, and gitignored since uploads are per-environment data, not code.
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB — comfortably covers a phone photo or a several-minute voice memo.

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || extensionForMimeType(file.mimetype);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES },
});

function extensionForMimeType(mimeType: string): string {
  const [, subtype] = mimeType.split("/");
  return subtype ? `.${subtype.split(";")[0]}` : "";
}

function kindForMimeType(mimeType: string): "photo" | "voice" | null {
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("audio/")) return "voice";
  return null;
}

function authenticate(req: { headers: { authorization?: string } }): string | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;
  return payload?.sub ?? null;
}

async function assertOwnsNote(noteId: string, userId: string) {
  return prisma.note.findFirst({
    where: { id: noteId, deletedAt: null, knowledgeBase: { ownerId: userId } },
  });
}

export function registerAttachmentRoutes(app: Express): void {
  app.post("/attachments/:noteId", upload.single("file"), async (req, res) => {
    const userId = authenticate(req);
    if (!userId) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const note = await assertOwnsNote(req.params.noteId, userId);
    if (!note) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const kind = kindForMimeType(req.file.mimetype);
    if (!kind) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: "Only image/* and audio/* attachments are supported" });
      return;
    }

    const attachment = await prisma.attachment.create({
      data: {
        noteId: note.id,
        kind,
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    res.json({
      id: attachment.id,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt,
    });
  });

  app.get("/attachments/file/:id", async (req, res) => {
    const userId = authenticate(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const attachment = await prisma.attachment.findFirst({
      where: { id: req.params.id, note: { deletedAt: null, knowledgeBase: { ownerId: userId } } },
    });
    if (!attachment) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.setHeader("Content-Type", attachment.mimeType);
    res.sendFile(path.join(UPLOAD_DIR, attachment.filename), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "File missing" });
    });
  });
}

export function attachmentFilePath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}
