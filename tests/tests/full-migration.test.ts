import { execa } from 'execa';
import fse from 'fs-extra';
import { beforeAll, describe, expect, test } from 'vitest';

import { assertEmberTest, migrate } from '../assertions.js';
import {
  type Project,
  addonFrom,
  build,
  findFixtures,
  lintAddon,
  lintTestApp,
} from '../helpers.js';

let fixtures = await findFixtures();

for (let fixtureName of fixtures) {
  describe(`default command on fixture: ${fixtureName}`, () => {
    let project: Project;

    beforeAll(async () => {
      project = await addonFrom(fixtureName);
      await migrate(project);
      await build(project);
    });

    test('verify tmp project', async () => {
      console.debug(`verify tmp project 'ls -la' @ ${project.rootPath}`);

      await execa('ls', ['-la'], { cwd: project.rootPath, stdio: 'inherit' });

      expect(
        await fse.pathExists(project.rootPath),
        `rootPath: ${project.rootPath}`
      ).toBe(true);
      expect(
        await fse.pathExists(project.addonPath),
        `addonPath: ${project.addonPath}`
      ).toBe(true);
      expect(
        await fse.pathExists(project.testAppPath),
        `testAppPath: ${project.testAppPath}`
      ).toBe(true);
    });

    test('lint addon', async () => {
      let result = await lintAddon(project);

      expect(result).toMatchObject({ exitCode: 0 });
    });

    test('lint test-app', async () => {
      let result = await lintTestApp(project);

      expect(result).toMatchObject({ exitCode: 0 });
    });

    test('tests pass', async () => {
      await assertEmberTest(project);
    });
  });
}
