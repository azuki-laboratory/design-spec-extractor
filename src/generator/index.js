// generator/index.js — DesignGenerator 공개 API 조립 (ESM)
import { generate } from './doc.js';
import { exportTokens, merge, exportPreview, exportTailwind, exportAgentPrompt } from './exporters.js';
import { computeDNA, computeLint, mascotComment, designFingerprint, exportPassport } from './signature.js';
import { exportKit, buildKitZip, buildCustomKitPage, customKitSystemPrompt, parseKitStructure } from './kit.js';

export const DesignGenerator = {
  generate, exportTokens, merge, exportPreview, exportTailwind,
  computeDNA, computeLint, mascotComment, exportAgentPrompt, designFingerprint, exportPassport,
  exportKit, buildKitZip, buildCustomKitPage, customKitSystemPrompt, parseKitStructure,
};
