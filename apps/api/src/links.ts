import { extractHashtags, extractWikiLinkTitles } from "@simplekasten/core";
import { prisma } from "@simplekasten/db";

/** Next zettel ID for a new top-level note in this knowledge base — "1", "2", ... */
export async function nextZettelId(kbId: string): Promise<string> {
  const count = await prisma.note.count({ where: { kbId } });
  return String(count + 1);
}

/**
 * Re-derives every outbound [[link]] for a note from its current content.
 * A link to a title that doesn't exist yet in this vault is stored unresolved —
 * normal Zettelkasten practice — and flips to resolved the moment that note is
 * created (see resolveIncomingLinks below).
 */
export async function syncOutboundLinks(noteId: string, kbId: string, content: string): Promise<void> {
  const titles = extractWikiLinkTitles(content);

  await prisma.link.deleteMany({ where: { sourceNoteId: noteId } });
  if (titles.length === 0) return;

  const targets = await prisma.note.findMany({
    where: { kbId, title: { in: titles, mode: "insensitive" }, deletedAt: null },
    select: { id: true, title: true },
  });
  const byTitle = new Map(targets.map((n) => [n.title.toLowerCase(), n.id]));

  await prisma.link.createMany({
    data: titles.map((title) => {
      const targetNoteId = byTitle.get(title.toLowerCase());
      return {
        sourceNoteId: noteId,
        targetTitle: title,
        targetNoteId: targetNoteId ?? null,
        resolved: Boolean(targetNoteId),
      };
    }),
  });
}

/**
 * Re-derives a note's tags from #hashtags in its content — same "content is
 * the source of truth" pattern as syncOutboundLinks, so there's no separate
 * tag-editing UI to keep in sync with what's actually written.
 */
export async function syncTags(noteId: string, kbId: string, content: string): Promise<void> {
  const names = extractHashtags(content);

  await prisma.noteTag.deleteMany({ where: { noteId } });
  if (names.length === 0) return;

  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { kbId_name: { kbId, name } },
      create: { kbId, name },
      update: {},
    });
    await prisma.noteTag.upsert({
      where: { noteId_tagId: { noteId, tagId: tag.id } },
      create: { noteId, tagId: tag.id },
      update: {},
    });
  }
}

/** Resolves any pre-existing [[links]] that were waiting for this note to exist. */
export async function resolveIncomingLinks(noteId: string, kbId: string, title: string): Promise<void> {
  await prisma.link.updateMany({
    where: {
      resolved: false,
      targetNoteId: null,
      targetTitle: { equals: title, mode: "insensitive" },
      sourceNote: { kbId },
    },
    data: { targetNoteId: noteId, resolved: true },
  });
}
