# MyGrammar

An offline-first English grammar assistant built with vanilla HTML, CSS and JavaScript.

## Goal
MyGrammar is a personal backup for English writing when cloud AI services are unavailable.

## Architecture
- `index.html` — interface
- `app.js` — rule engine
- `style.css` — UI
- `data/*.json` — Grammar Knowledge Base

The knowledge base is separated from JavaScript so rules can grow without rewriting the engine.

## Current checks
- Present Simple third-person singular
- Basic subject–auxiliary agreement
- Common Indonesian-English learner errors
- Basic tense signal detection
- Irregular verb reference

## Roadmap
- All 12 tenses
- Articles
- Prepositions
- Countable / uncountable nouns
- Modal verbs
- Conditionals
- Gerund / infinitive
- Question formation
- More Indonesian-English common errors
- LocalStorage personal dictionary
- PWA offline installation

## Offline
No AI or external grammar API is used. JSON knowledge files live in the repository.


## Knowledge Base Pipeline

MyGrammar can refresh selected open-source language data into local JSON files.

### Force refresh locally

```bash
python -m pip install lxml
python scripts/build_kb.py --force
```

### Refresh only one source

```bash
python scripts/build_kb.py --force --source languagetool
python scripts/build_kb.py --force --source wordfreq
```

### Automatic refresh

GitHub Actions runs `Refresh MyGrammar Knowledge Base` weekly and also exposes a manual `workflow_dispatch` action with a `force` option.

Generated files:

- `data/external/languagetool_runtime.json`
- `data/external/common_words.json`
- `data/external/build_summary.json`

Source attribution and license information are documented in `DATA_SOURCES.md` and `licenses/`.

LanguageTool rules remain separately identified as LGPL-2.1-or-later data, and wordfreq-derived data remains identified as CC BY-SA 4.0.
