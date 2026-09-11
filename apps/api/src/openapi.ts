/**
 * Simplekasten REST API - OpenAPI 3.0.0 Specification
 *
 * This file documents the REST API for Simplekasten.
 * Generate an OpenAPI spec using: npm run generate:openapi
 */

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Simplekasten API",
    description: "A Zettelkasten-based memory management app API",
    version: "1.0.0",
    contact: {
      name: "Simplekasten",
    },
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local development",
    },
    {
      url: "https://api.simplekasten.com",
      description: "Production",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token in Authorization header",
      },
    },
    schemas: {
      Note: {
        type: "object",
        required: [
          "id",
          "kbId",
          "zettelId",
          "title",
          "content",
          "type",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", description: "Unique note ID (UUID)" },
          kbId: { type: "string", description: "Knowledge base ID" },
          zettelId: {
            type: "string",
            description: "Luhmann-style ID (e.g., 3a1)",
          },
          title: { type: "string" },
          content: { type: "string", description: "Markdown content" },
          type: {
            type: "string",
            enum: ["fleeting", "literature", "permanent"],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          deletedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      NoteDetail: {
        allOf: [
          { $ref: "#/components/schemas/Note" },
          {
            type: "object",
            properties: {
              tagNames: { type: "array", items: { type: "string" } },
              backlinks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    noteId: { type: "string" },
                    title: { type: "string" },
                    zettelId: { type: "string" },
                    context: { type: "string" },
                  },
                },
              },
              contents: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    noteId: { type: "string", nullable: true },
                    title: { type: "string" },
                    zettelId: { type: "string", nullable: true },
                    resolved: { type: "boolean" },
                  },
                },
              },
              attachments: {
                type: "array",
                items: { $ref: "#/components/schemas/Attachment" },
              },
            },
          },
        ],
      },
      Tag: {
        type: "object",
        required: ["id", "name", "noteCount"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          noteCount: { type: "integer" },
        },
      },
      KnowledgeBase: {
        type: "object",
        required: ["id", "ownerId", "name", "slug", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" },
          ownerId: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          isDefault: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Attachment: {
        type: "object",
        required: ["id", "kind", "mimeType", "size", "createdAt"],
        properties: {
          id: { type: "string" },
          kind: { type: "string" },
          mimeType: { type: "string" },
          size: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AuthTokens: {
        type: "object",
        required: ["accessToken", "refreshToken", "userId"],
        properties: {
          accessToken: {
            type: "string",
            description: "JWT access token (15 minute TTL)",
          },
          refreshToken: {
            type: "string",
            description: "Opaque refresh token (30 day TTL)",
          },
          userId: { type: "string" },
        },
      },
      GraphData: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                zettelId: { type: "string" },
                type: { type: "string" },
              },
            },
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string" },
                target: { type: "string" },
              },
            },
          },
        },
      },
      SearchResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          zettelId: { type: "string" },
          title: { type: "string" },
          type: { type: "string" },
          snippet: {
            type: "string",
            description: "Search result excerpt with special highlight markers",
          },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                enum: [
                  "UNAUTHORIZED",
                  "FORBIDDEN",
                  "NOT_FOUND",
                  "CONFLICT",
                  "BAD_REQUEST",
                  "INTERNAL_SERVER_ERROR",
                ],
              },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        responses: {
          200: {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        summary: "Register a new user",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "displayName"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  displayName: { type: "string", minLength: 1, maxLength: 120 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "User registered successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthTokens" },
              },
            },
          },
          409: {
            description: "Email already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Login user",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthTokens" },
              },
            },
          },
          401: {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        summary: "Refresh access token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Token refreshed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthTokens" },
              },
            },
          },
          401: {
            description: "Invalid or expired refresh token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "Logout user",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Logout successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/notes": {
      get: {
        summary: "List notes in knowledge base",
        tags: ["Notes"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "kbId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "tag",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Notes list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Note" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new note",
        tags: ["Notes"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["kbId", "title", "content", "type"],
                properties: {
                  kbId: { type: "string" },
                  title: { type: "string" },
                  content: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["fleeting", "literature", "permanent"],
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Note created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Note" },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/notes/search": {
      get: {
        summary: "Search notes",
        tags: ["Notes"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "kbId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "query",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SearchResult" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/notes/{id}": {
      get: {
        summary: "Get note by ID",
        tags: ["Notes"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Note details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NoteDetail" },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Note not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      put: {
        summary: "Update note",
        tags: ["Notes"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["fleeting", "literature", "permanent"],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Note updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Note" },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Note not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      delete: {
        summary: "Delete note (soft delete)",
        tags: ["Notes"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Note deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { id: { type: "string" } },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Note not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/notes/{id}/graph": {
      get: {
        summary: "Get graph view for knowledge base",
        tags: ["Notes"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Knowledge base ID",
          },
        ],
        responses: {
          200: {
            description: "Graph data",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GraphData" },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/tags": {
      get: {
        summary: "List tags in knowledge base",
        tags: ["Tags"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "kbId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Tags list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Tag" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/vaults": {
      get: {
        summary: "List user's knowledge bases",
        tags: ["Vaults"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Vaults list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/KnowledgeBase" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new knowledge base",
        tags: ["Vaults"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Vault created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/KnowledgeBase" },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/attachments": {
      get: {
        summary: "List attachments for a note",
        tags: ["Attachments"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "noteId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Attachments list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Attachment" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/attachments/{id}": {
      delete: {
        summary: "Delete attachment",
        tags: ["Attachments"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Attachment deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { id: { type: "string" } },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          404: {
            description: "Attachment not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
};
