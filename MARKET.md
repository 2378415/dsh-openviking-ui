# Publishing to the DSH plugin market

The market is not a directory: it reads the curated list
[`awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin).
Getting listed means **one YAML file in a PR there**; being listed is also what
lets users install from inside the market at all.

This file records everything already prepared, and what is still yours to do.

## 1. Already done in this repo

| Item | State |
| --- | --- |
| `dsh.bundle` manifest (`cordis.patch.yml`) | present — the one thing most submissions miss |
| `dsh.client` for the browser half | present (`platform: web`, `immediately: true`) |
| `private` removed from `package.json` | done |
| `license`, `author`, `repository`, `homepage`, `bugs` | added (MIT; repository `2378415/dsh-openviking-ui`) |
| `engines.dsh` | `>=0.2.1-rc.2 <1.0.0-0` (verified on 0.2.1-rc.3) |
| `publishConfig.access` | `public` |
| `LICENSE` | MIT |
| Raster storefront icon | `assets/icon-180.png` (180×180 PNG; the list refuses SVG) |
| `npm pack --dry-run` | 16 files, 35.7 kB packed / 130 kB unpacked — verified |
| Runtime dependencies | none (no `node_modules` needed at install) |

Packed contents (verified): `README.md`, `client.js`, `cordis.patch.yml`,
`icon.svg`, `index.js`, `lib/*` (8 modules), `locale/{en,zh}.json`,
`package.json`.

## 2. The submission itself

One new file in the registry repo — nothing else:

`data/plugins/2378415__dsh-openviking-ui.yml`

```yaml
url: https://github.com/2378415/dsh-openviking-ui
name: 2378415/dsh-openviking-ui
category: ui
description:
  en: Settings for the OpenViking memory plugin's server and project identity, plus a sidebar card and a per-turn line reporting what was written.
  zh: 为 OpenViking 记忆插件配置服务地址与项目身份，并在左栏卡片与每轮结尾显示写入与排队情况。
icon: https://raw.githubusercontent.com/2378415/dsh-openviking-ui/main/assets/icon-180.png
```

- **`url` must match the repository exactly** — the gate compares it.
- `category`: `ui` is the honest fit (it adds a settings surface, a sidebar
  card and a chat line). A near miss is re-filed by a maintainer, not rejected.
- Description must end with a period and state only what the code does. If it
  contains `": "`, quote the whole value.
- `icon` must be a GitHub-hosted **raster** (`png/jpg/jpeg/webp`); SVG is
  refused by the list.
- Optional `tarball:` only if the repo cannot be installed from source — not
  needed here.

## 3. Before the PR

1. Create the GitHub repository, push this directory, add the **`dsh-plugin`**
   topic on the repo page.
2. Wait **1 day** — CI checks repository age; a repo created minutes before the
   PR is rejected automatically.
3. Optional but recommended: publish to npm (`npm publish`); the list then shows
   a download count. The published `package.json` **`repository` field must point
   back at this same repository**, or the package is not linked to the entry.

## 4. Optional extras

- `screenshots.json` next to `package.json`, listing 1–8 repository-relative
  image paths, gives the market App Store-style screenshots. Absolute URLs are
  accepted only on GitHub hosting.
- `npm publish` first, then the PR — reviewers can install the released build.

## 5. Account

`package.json` now points at `https://github.com/2378415/dsh-openviking-ui`
(`repository`, `homepage`, `bugs`), and the entry below uses the same owner. The
`author` field still says `JinPeng` and `LICENSE` still carries that holder —
change both to whatever name you want shown on npm (the GitHub account is
`2378415`; the npm author name does not have to match it).

## 6. How review works (so you know what to expect)

CI checks entry count, `dsh.bundle`, repository age and formatting; a maintainer
then reads the code against the description. Requests for changes arrive as a PR
comment with a `held: author` label — push fixes to the same branch and leave one
comment; the label is retired only by a re-review.
