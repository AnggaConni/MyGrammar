#!/usr/bin/env python3
"""
Build MyGrammar's local Knowledge Base from openly licensed upstream sources.

Usage:
  python scripts/build_kb.py
  python scripts/build_kb.py --force
  python scripts/build_kb.py --source languagetool
  python scripts/build_kb.py --source wordfreq
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "external"
DATA.mkdir(parents=True, exist_ok=True)

LANGUAGETOOL_URL = (
    "https://raw.githubusercontent.com/languagetool-org/languagetool/"
    "master/languagetool-language-modules/en/src/main/resources/"
    "org/languagetool/rules/en/grammar.xml"
)
WORDFREQ_URL = (
    "https://raw.githubusercontent.com/aparrish/wordfreq-en-25000/"
    "master/wordfreq-en-25000-log.json"
)

HEADERS = {"User-Agent": "MyGrammar-KB-Builder/1.0"}
MAX_RUNTIME_RULES = 5000


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def text_content(node: Any) -> str:
    return " ".join(" ".join(node.itertext()).split())


def escape_literal(value: str) -> str:
    return re.escape(value)


def token_regex(token: Any) -> str | None:
    attrs = token.attrib

    # These features require LanguageTool's POS/tag engine and cannot be
    # reproduced safely by our lightweight browser-side rule engine.
    advanced = {
        "postag",
        "postag_regexp",
        "chunk_re",
        "skip",
        "negate_pos",
        "negate_pos_regexp",
        "negate_chunk",
        "negate_chunk_regexp",
    }
    if any(key in attrs for key in advanced):
        return None

    raw = text_content(token)
    if not raw:
        return None

    if attrs.get("regexp") == "yes":
        return raw

    return escape_literal(raw)


def build_runtime_pattern(pattern: Any) -> str | None:
    tokens = list(pattern.findall("token"))
    # Only export single-token rules to the browser runtime. Multi-token
    # LanguageTool rules often use markers/unification/POS context, and a
    # naive regex conversion can produce false positives or replace the
    # wrong span. Those remain upstream-only reference rules.
    if len(tokens) != 1:
        return None
    if not tokens:
        return None

    pieces: list[str] = []
    for token in tokens:
        part = token_regex(token)
        if part is None:
            return None

        raw = text_content(token)
        # Word boundaries are useful for alphabetic tokens but harmful for
        # punctuation and contractions.
        if re.fullmatch(r"[A-Za-z]+(?:['’][A-Za-z]+)?", raw):
            part = r"\b" + part + r"\b"

        pieces.append(part)

    return r"\s+".join(pieces)


def collect_rules(xml_bytes: bytes) -> tuple[list[dict[str, Any]], dict[str, int]]:
    try:
        from lxml import etree
    except ImportError as exc:
        raise SystemExit(
            "lxml is required. Run: python -m pip install lxml"
        ) from exc

    parser = etree.XMLParser(
        load_dtd=True,
        resolve_entities=True,
        recover=True,
        huge_tree=True,
        no_network=False,
    )
    root = etree.fromstring(xml_bytes, parser)

    all_rules: list[dict[str, Any]] = []
    runtime_rules: list[dict[str, Any]] = []
    skipped = 0

    for group in root.xpath(".//rulegroup"):
        group_id = group.get("id", "")
        group_name = group.get("name", "")

        for rule in group.xpath("./rule"):
            rule_id = rule.get("id", "") or group_id
            name = rule.get("name", "") or group_name

            pattern = rule.find("./pattern")
            if pattern is None:
                skipped += 1
                continue

            message = text_content(rule.find("./message")) if rule.find("./message") is not None else ""
            short = text_content(rule.find("./short")) if rule.find("./short") is not None else ""
            suggestions = [
                text_content(s)
                for s in rule.findall("./suggestion")
                if text_content(s)
            ]

            entry = {
                "id": rule_id,
                "name": name,
                "category": group_name or "LanguageTool",
                "message": message,
                "short": short,
                "suggestions": suggestions,
                "source": "LanguageTool English",
                "source_url": LANGUAGETOOL_URL,
                "license": "LGPL-2.1-or-later",
            }
            all_rules.append(entry)

            runtime = build_runtime_pattern(pattern)
            # Safe browser rules are literal/simple patterns with a single
            # concrete replacement. Match references like \1 or POS-dependent
            # suggestions are deliberately excluded.
            safe_suggestion = (
                suggestions[0].strip()
                if suggestions and not re.search(r"\\[0-9]|<match|<suggestion", suggestions[0])
                else ""
            )
            if safe_suggestion and len(safe_suggestion) > 80:
                safe_suggestion = ""
            if runtime and safe_suggestion and len(runtime_rules) < MAX_RUNTIME_RULES:
                runtime_rules.append(
                    {
                        "id": rule_id,
                        "name": name,
                        "category": group_name or "LanguageTool",
                        "message": message,
                        "regex": runtime,
                        "suggestion": safe_suggestion,
                        "source": "LanguageTool English",
                        "license": "LGPL-2.1-or-later",
                    }
                )
            elif not runtime:
                skipped += 1

    stats = {
        "all_rules": len(all_rules),
        "runtime_safe_rules": len(runtime_rules),
        "advanced_or_skipped": skipped,
    }
    return runtime_rules, {
        **stats,
    }


def load_wordfreq(raw: bytes) -> list[dict[str, Any]]:
    data = json.loads(raw.decode("utf-8"))
    rows = []
    for row in data:
        if isinstance(row, list) and len(row) == 2:
            word, score = row
            rows.append([word, score])
    return rows


def write_json(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Refresh even when cached upstream data exists.",
    )
    parser.add_argument(
        "--source",
        choices=("all", "languagetool", "wordfreq"),
        default="all",
    )
    args = parser.parse_args()

    summary: dict[str, Any] = {
        "builder": "MyGrammar Knowledge Base Builder",
        "forced": args.force,
        "sources": {},
    }

    if args.source in ("all", "languagetool"):
        raw = download(LANGUAGETOOL_URL)
        runtime_rules, stats = collect_rules(raw)
        write_json(
            DATA / "languagetool_runtime.json",
            {
                "source": {
                    "name": "LanguageTool English",
                    "url": LANGUAGETOOL_URL,
                    "license": "LGPL-2.1-or-later",
                },
                "stats": stats,
                "rules": runtime_rules,
            },
        )
        summary["sources"]["languagetool"] = stats

    if args.source in ("all", "wordfreq"):
        raw = download(WORDFREQ_URL)
        words = load_wordfreq(raw)
        write_json(
            DATA / "common_words.json",
            {
                "source": {
                    "name": "wordfreq-en-25000",
                    "url": WORDFREQ_URL,
                    "license": "CC-BY-SA-4.0",
                },
                "count": len(words),
                "format": "[word, log_frequency]",
                "words": words,
            },
        )
        summary["sources"]["wordfreq"] = {"words": len(words)}

    write_json(DATA / "build_summary.json", summary)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
