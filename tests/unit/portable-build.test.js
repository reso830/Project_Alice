import fs from 'node:fs';

import { describe, expect, test } from 'vitest';

const buildScript = fs.readFileSync('scripts/build-portable.mjs', 'utf8');

describe('portable build artifact shape', () => {
  test('zips the staged alice contents without nesting an alice folder', () => {
    expect(buildScript).toContain('Compress-Archive -Path');
    expect(buildScript).toContain("}\\\\*' -DestinationPath");
    expect(buildScript).not.toContain("Compress-Archive -LiteralPath '${STAGE_DIR");
  });
});
