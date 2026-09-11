import type { NoteType } from "@simplekasten/core";

/**
 * Everything the vault engine needs from a filesystem, kept minimal enough
 * that both a Node `fs` adapter (desktop) and an `expo-file-system` adapter
 * (mobile) can implement it — this is what makes one engine run on both
 * platforms against the same on-disk vault format.
 */
export interface FileSystemAdapter {
  /** Filenames (not full paths) of the plain files directly inside `dir`. */
  listFiles(dir: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
}

/** A note as stored on disk: YAML frontmatter + raw markdown body. */
export interface VaultNote {
  id: string;
  zettelId: string;
  title: string;
  type: NoteType;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NoteListItem {
  id: string;
  zettelId: string;
  title: string;
  type: NoteType;
  updatedAt: string;
}

export interface BacklinkItem {
  noteId: string;
  title: string;
  zettelId: string;
}

export interface ContentsItem {
  noteId: string | null;
  title: string;
  zettelId: string | null;
  resolved: boolean;
}

export interface NoteDetail {
  id: string;
  zettelId: string;
  title: string;
  content: string;
  type: NoteType;
  createdAt: string;
  updatedAt: string;
  tagNames: string[];
  backlinks: BacklinkItem[];
  contents: ContentsItem[];
}

export interface TagItem {
  id: string;
  name: string;
  noteCount: number;
}

export interface GraphNode {
  id: string;
  title: string;
  zettelId: string;
  type: NoteType;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SearchResultItem {
  id: string;
  title: string;
  zettelId: string;
  snippet: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  type?: NoteType;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  content?: string;
  type?: NoteType;
}

export interface LinkRef {
  sourceNoteId: string;
  targetNoteId: string | null;
  targetTitle: string;
  resolved: boolean;
}
