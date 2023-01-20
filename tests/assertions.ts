import { execa } from 'execa';
import { expect } from 'vitest';

import { type Project, binPath, emberTest } from './helpers.js';

export async function migrate(project: Project) {
  let { stdout } = await execa('node', [binPath], { cwd: project.rootPath });

  expect(stdout).toMatch(
    `🎉 Congratulations! Your addon is now formatted as a V2 addon!`
  );
}

export async function assertEmberTest(project: Project) {
  let { stdout, exitCode } = await emberTest(project);

  // subset of full stdout
  // can't use snapshot testing due to time taken printed
  // to stdout
  console.debug(stdout);
  expect(exitCode).toEqual(0);
  expect(stdout).toMatch('Built project successfully');
  expect(stdout).toMatch('# skip  0');
  expect(stdout).toMatch('# todo  0');
  expect(stdout).toMatch('# fail  0');
}