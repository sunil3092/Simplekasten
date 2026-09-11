import { slugify } from "@simplekasten/core";
import { prisma } from "@simplekasten/db";
import archiver from "archiver";
import type { Express } from "express";
import { verifyAccessToken } from "./auth";

// A plain REST route rather than a tRPC procedure: tRPC's HTTP adapter is
// built around JSON request/response bodies, not streaming a binary zip, so
// this reimplements just enough of the tRPC auth context (Bearer token in
// the Authorization header) to authorize the request the same way.
export function registerExportRoute(app: Express): void {
  app.get("/export/:kbId", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const payload = token ? verifyAccessToken(token) : null;
    if (!payload) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const kb = await prisma.knowledgeBase.findFirst({ where: { id: req.params.kbId, ownerId: payload.sub } });
    if (!kb) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const notes = await prisma.note.findMany({
      where: { kbId: kb.id, deletedAt: null },
      select: { zettelId: true, title: true, content: true, type: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(kb.name, "vault")}-export.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => res.destroy(err));
    archive.pipe(res);

    const usedNames = new Set<string>();
    for (const note of notes) {
      let filename = `${note.zettelId}-${slugify(note.title)}.md`;
      // Two notes can slugify to the same filename (e.g. "Draft" and "draft!");
      // fall back to disambiguating with the note's own zettelId suffix.
      while (usedNames.has(filename)) filename = `${note.zettelId}-${slugify(note.title)}-${usedNames.size}.md`;
      usedNames.add(filename);

      const frontmatter = [
        "---",
        `zettel_id: "${note.zettelId}"`,
        `title: "${note.title.replace(/"/g, '\\"')}"`,
        `type: ${note.type}`,
        `created: ${note.createdAt.toISOString()}`,
        `updated: ${note.updatedAt.toISOString()}`,
        "---",
        "",
      ].join("\n");

      archive.append(`${frontmatter}${note.content}\n`, { name: filename });
    }

    await archive.finalize();
  });
}
