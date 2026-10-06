# MyGrammar External Knowledge Sources

MyGrammar uses a local, generated Knowledge Base so the runtime application can work without internet access.

## 1. LanguageTool English

Repository: https://github.com/languagetool-org/languagetool

Source:
`languagetool-language-modules/en/src/main/resources/org/languagetool/rules/en/grammar.xml`

License: LGPL-2.1-or-later.

The builder extracts a subset of simple rules into `data/external/languagetool_runtime.json`. Advanced LanguageTool rules that depend on POS tags, chunking, unification, or other LanguageTool-specific runtime features are intentionally not executed by MyGrammar's lightweight browser engine.

## 2. wordfreq-en-25000

Repository: https://github.com/aparrish/wordfreq-en-25000

The builder imports the word-frequency list into `data/external/common_words.json`.

The upstream README states that this data is distributed under CC BY-SA 4.0. Attribution must be preserved.

## Refreshing

Manual local refresh:

`python -m pip install lxml`

`python scripts/build_kb.py --force`

GitHub Actions also refreshes the data weekly and exposes a manual **Run workflow** action.

## Important

The generated external data keeps source and license metadata. Do not remove these attribution fields when transforming or redistributing the generated datasets.
