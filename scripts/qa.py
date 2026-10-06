#!/usr/bin/env python3
"""MyGrammar repository quality checks. No network access required."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def fail(message: str):
    print("QA FAIL:", message)
    raise SystemExit(1)


def main():
    tenses = load_json(DATA / "tenses.json")
    if len(tenses) != 12:
        fail(f"Expected 12 tenses, got {len(tenses)}")

    required_example_keys = {"positive", "negative", "question"}
    for tense in tenses:
        if not required_example_keys.issubset((tense.get("examples") or {}).keys()):
            fail(f"Missing positive/negative/question examples: {tense.get('id')}")
        if not tense.get("formula"):
            fail(f"Missing formula: {tense.get('id')}")

    verbs = load_json(DATA / "verbs.json")
    seen = set()
    for verb in verbs:
        for key in ("v1", "v2", "v3", "type"):
            if not verb.get(key):
                fail(f"Verb missing {key}: {verb}")
        key = (verb["v1"].lower(), verb["v2"].lower(), verb["v3"].lower())
        if key in seen:
            fail(f"Duplicate verb triplet: {key}")
        seen.add(key)
        if verb["type"] not in {"regular", "irregular"}:
            fail(f"Invalid verb type: {verb['type']}")

    contractions = load_json(DATA / "contractions.json")
    seen = set()
    for rule in contractions:
        wrong = rule.get("wrong", "").lower()
        if not wrong or not rule.get("correct"):
            fail(f"Invalid contraction rule: {rule}")
        if wrong in seen:
            fail(f"Duplicate contraction rule: {wrong}")
        seen.add(wrong)

    for name in ("common_errors.json", "samples.json", "grammar_rules.json", "verb_patterns.json", "learner_errors_id.json"):
        load_json(DATA / name)

    verb_patterns = load_json(DATA / "verb_patterns.json")
    allowed_pattern_kinds = {"gerund_after", "infinitive_after", "fixed_gerund"}
    pattern_ids = set()
    for rule in verb_patterns:
        for key in ("id", "kind", "title", "formula", "explanation"):
            if not rule.get(key):
                fail(f"Verb pattern missing {key}: {rule}")
        if rule["kind"] not in allowed_pattern_kinds:
            fail(f"Invalid verb pattern kind: {rule['kind']}")
        if rule["id"] in pattern_ids:
            fail(f"Duplicate verb pattern id: {rule['id']}")
        pattern_ids.add(rule["id"])
        if rule["kind"] != "fixed_gerund" and not rule.get("verbs"):
            fail(f"Verb pattern has no verbs: {rule['id']}")
        if rule["kind"] == "fixed_gerund" and not rule.get("phrase"):
            fail(f"Fixed verb pattern has no phrase: {rule['id']}")

    learner_errors = load_json(DATA / "learner_errors_id.json")
    learner_ids = set()
    learner_wrong = set()
    for rule in learner_errors:
        for key in ("id", "wrong", "correct", "category", "title", "explanation"):
            if not rule.get(key):
                fail(f"Learner error missing {key}: {rule}")
        if rule["id"] in learner_ids:
            fail(f"Duplicate learner error id: {rule['id']}")
        learner_ids.add(rule["id"])
        wrong = rule["wrong"].lower()
        if wrong in learner_wrong:
            fail(f"Duplicate learner error pattern: {wrong}")
        learner_wrong.add(wrong)

    catalog_path = DATA / "external" / "languagetool_catalog.json"
    if catalog_path.exists():
        catalog = load_json(catalog_path)
        if catalog.get("count", 0) < 1000:
            fail("LanguageTool catalog unexpectedly small")
        if len(catalog.get("rules", [])) != catalog.get("count"):
            fail("LanguageTool catalog count does not match rule entries")

    summary_path = DATA / "external" / "build_summary.json"
    if summary_path.exists():
        summary = load_json(summary_path)
        lt = summary.get("sources", {}).get("languagetool", {})
        if lt.get("all_rules", 0) < 1000:
            fail("LanguageTool reference catalog unexpectedly small")
        if lt.get("runtime_safe_rules", 0) > lt.get("all_rules", 0):
            fail("Runtime rule count exceeds catalog count")

    print("QA PASS")
    print(f"tenses={len(tenses)} verbs={len(verbs)} contractions={len(contractions)} verb_patterns={len(verb_patterns)} learner_errors_id={len(learner_errors)}")


if __name__ == "__main__":
    main()
