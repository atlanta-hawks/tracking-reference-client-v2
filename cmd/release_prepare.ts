/* eslint-disable no-console */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'graceful-fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version as currentVersion } from '../package.json';

import { formatSemver, parseSemver } from './utils';

console.log('release: prepare');

const { _: args } = (yargs(hideBin(process.argv)) as any).parse();
let nextVersion = String(args[0]);
let staticVersion = false;

const v = parseSemver(currentVersion);
switch (nextVersion) {
  case 'patch':
    v.patch++;
    break;
  case 'minor':
    v.minor++;
    break;
  case 'major':
    v.major++;
    break;
  case 'bump':
    v.iter++;
    break;
  default:
    staticVersion = true;
}
if (!staticVersion) {
  nextVersion = formatSemver(v);
}

const ticket = String(execSync('git rev-parse --abbrev-ref HEAD')).trim();
const tagName = 'v' + nextVersion;
const commitMsg = `"chore(${ticket}): release ${tagName}"`;

console.log(`releasing: ${tagName} (${ticket})`);

if (nextVersion !== currentVersion) {
  fs.writeFileSync(
    './src/version.ts',
    `export const VERSION = '${nextVersion}';` + '\n'
  );
  execSync(`npm version ${nextVersion} --no-git-tag-version -m ${commitMsg}`);
  console.log('release: version bumped');
}

spawnSync('git', ['add', '.'], { stdio: 'inherit' });
execSync('git commit -m ' + commitMsg);

console.log('release: done');
process.exit(0);
