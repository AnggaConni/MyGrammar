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
