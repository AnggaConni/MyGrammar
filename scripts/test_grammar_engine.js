#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function loadEngine() {
  const source = fs.readFileSync(path.join(ROOT, 'grammar-engine.js'), 'utf8');
  const context = vm.createContext({ window: {} });
  new vm.Script(source, { filename: 'grammar-engine.js' }).runInContext(context);
  if (!context.window.MyGrammarGrammarEngine) {
    throw new Error('MyGrammarGrammarEngine was not exported.');
  }
  return context.window.MyGrammarGrammarEngine;
}

function loadKnowledge() {
  return {
    rules: readJson('data/grammar_rules.json'),
    tenses: readJson('data/tenses.json'),
    commonErrors: readJson('data/common_errors.json'),
    contractions: readJson('data/contractions.json'),
    verbs: readJson('data/verbs.json'),
    samples: readJson('data/samples.json'),
    externalRules: readJson('data/external/languagetool_runtime.json').rules || [],
    commonWords: [],
    loaded: true
  };
}

function normalizeFindings(findings) {
  return findings
    .map((item) => ({
      start: item.start,
      end: item.end,
      wrong: item.wrong,
      correct: item.correct,
      category: item.category,
      title: item.title
    }))
    .sort((a, b) =>
      a.start - b.start ||
      a.end - b.end ||
      a.correct.localeCompare(b.correct)
    );
}

function normalizeExpected(items) {
  return items
    .map((item) => ({
      wrong: item.wrong,
      correct: item.correct,
      category: item.category,
      title: item.title
    }))
    .sort((a, b) =>
      a.wrong.localeCompare(b.wrong) ||
      a.correct.localeCompare(b.correct)
    );
}

function compareCase(engine, kb, testCase) {
  const findings = engine.analyze(testCase.input, kb);
  const actual = normalizeFindings(findings);
  const expected = normalizeExpected(testCase.expected || []);

  const comparableActual = actual.map(({ wrong, correct, category, title }) => ({
    wrong, correct, category, title
  }));

  const pass = JSON.stringify(comparableActual) === JSON.stringify(expected);

  const reasoningPass = pass && findings.every((finding) =>
    Array.isArray(finding.reasoning) && finding.reasoning.length > 0
  );

  return {
    pass: pass && reasoningPass,
    actual: comparableActual,
    expected,
    reasoningPass
  };
}

function main() {
  const suite = readJson('tests/grammar_cases.json');
  const engine = loadEngine();
  const kb = loadKnowledge();

  let passed = 0;
  let failed = 0;

  console.log('MyGrammar Grammar Engine Test Suite');
  console.log('===================================');
  console.log('Cases:', suite.cases.length);
  console.log('Vetted LanguageTool rules:', engine.trustedLanguageToolCount(kb));
  console.log('');

  for (const testCase of suite.cases) {
    let result;
    try {
      result = compareCase(engine, kb, testCase);
    } catch (error) {
      result = {
        pass: false,
        actual: [],
        expected: testCase.expected || [],
        error: error instanceof Error ? error.message : String(error)
      };
    }

    if (result.pass) {
      passed += 1;
      console.log('PASS', testCase.id, '-', testCase.input);
      continue;
    }

    failed += 1;
    console.error('FAIL', testCase.id, '-', testCase.input);
    if (result.error) console.error('  Error:', result.error);
    console.error('  Expected:', JSON.stringify(result.expected));
    console.error('  Actual:  ', JSON.stringify(result.actual));
    if (result.reasoningPass === false) {
      console.error('  Reasoning: missing reasoning chain.');
    }
  }

  console.log('');
  console.log(`Result: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

main();
