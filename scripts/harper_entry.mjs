import { WorkerLinter, LocalLinter, Dialect } from "harper.js";
import { binaryInlined } from "harper.js/binaryInlined";

globalThis.MyGrammarHarper = {
  WorkerLinter,
  LocalLinter,
  Dialect,
  binaryInlined
};
