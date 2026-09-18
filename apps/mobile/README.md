# Simplekasten Mobile (Expo)

Fully local, offline note-taking app — no login, no API. Notes live as plain
markdown files with YAML frontmatter in the app's own documents directory,
read and written through `@simplekasten/local-engine` via its Expo
file-system adapter. Photo and voice attachments are copied into the vault's
`attachments/` folder the same way.

## Run

```bash
npm install          # from the repo root
cd apps/mobile
npx expo start
```

Then open the app in Expo Go, a development build, or an iOS/Android
simulator from the options Expo prints.

Screens live under `src/app/` and use [Expo Router](https://docs.expo.dev/router/introduction)'s
file-based routing.
