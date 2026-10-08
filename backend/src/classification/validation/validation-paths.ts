/**
 * Default locations of the validation files, relative to `backend/` (where the
 * npm scripts run). Every CLI accepts flags to override them.
 */
export const VALIDATION_PATHS = {
  fixtures: 'test/fixtures',
  selection: 'test/fixtures/validation/selection.json',
  set: 'test/fixtures/validation/validation-set.json',
  volume: 'test/fixtures/validation/candidate-volume.json',
  sheetMarkdown: '../docs/validation/labelling-sheet.md',
  sheetCsv: '../docs/validation/labelling-sheet.csv',
  report: '../docs/validation-report.md',
} as const;
