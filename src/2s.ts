import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'graceful-fs';
import * as yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { CLIENT_ID, CLIENT_SECRET, get } from './auth';

dotenv.config();

const storage = new Storage();

const BASE_URL = process.env.SSI_BASE_URL || '';

const BUCKET_NAME = process.env.SSI_BUCKET_NAME || '__not_a_bucket__';
const bucket = (flagBucketName?: string) =>
  storage.bucket(flagBucketName || BUCKET_NAME);

interface Args {
  id: string;
  file: string;
  path?: string;
  local?: boolean;
  baseUrl?: string;
  bucketName?: string;
  clientId?: string;
  clientSecret?: string;
}

async function getToken(creds: Pick<Args, 'clientId' | 'clientSecret'>) {
  try {
    return await get(
      'hermes-api-external.prod',
      creds.clientId || CLIENT_ID,
      creds.clientSecret || CLIENT_SECRET
    );
  } catch (err) {
    console.error('auth reqest failed', err);
    throw new Error('Failed to authenticate request. Contact support.');
  }
}

async function saveFile({
  id,
  file,
  path,
  local,
  baseUrl = BASE_URL,
  ...creds
}: Args) {
  let ext = '.json';
  let isMappingFile = false;
  if (file === 'games' || file === 'teams' || file === 'players') {
    isMappingFile = true;
  } else if (
    file === 'advanced_box' ||
    file === 'markings' ||
    file === 'events' ||
    file === 'tracking'
  ) {
    if (file === 'advanced_box') {
      file = 'advanced-box';
    }
    if (file === 'events' || file === 'tracking') {
      ext = '.jsonl';
    }
  } else {
    throw new Error('invalid file name');
  }

  const dir = path || id;
  const filenameLocal = file + ext;
  const filenameRemote =
    (file === 'advanced_box' ? 'advanced-box' : file) + ext;

  let apiPath = '';
  if (isMappingFile) {
    apiPath = `/competitiondata/ssi/${filenameRemote}?competitionId=${id}`;
  } else {
    apiPath = `/gamedata/ssi/basketball-${filenameRemote}?gameId=${id}`;
  }

  const token = await getToken(creds);

  try {
    const res = await axios.get(baseUrl + apiPath, {
      ...(!local ? { responseType: 'stream' } : {}),
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        authorization: `Bearer ${token}`,
      },
    });

    if (!local) {
      const w = bucket(BUCKET_NAME) // TODO: replace with input flag
        .file(`${dir}/${filenameLocal}`)
        .createWriteStream({ contentType: 'application/json' });
      res.data.pipe(w);
    } else {
      fs.mkdirSync(dir, { recursive: true });

      const f = fs.openSync(`${dir}/${filenameLocal}`, 'w');
      fs.writeSync(f, ext === '.jsonl' ? res.data : JSON.stringify(res.data));
    }
  } catch (err) {
    console.error('save reqest failed', err);
    throw new Error('Failed to save file. Contact support.');
  }
}

yargs(hideBin(process.argv))
  .scriptName('second-spectrum')
  .command(
    'save_file',
    "save one of second spectrum's data files: [games, players, teams, advanced_box, events, markings, tracking]",
    (yargs_: any) => {
      yargs_
        .option('id', { type: 'string', demandOption: true })
        .option('file', { type: 'string', demandOption: true })
        .option('path', { type: 'string' })
        .option('local', { type: 'boolean' })
        .option('baseUrl', { type: 'string' })
        .option('bucketName', { type: 'string' })
        .option('clientId', { type: 'string' })
        .option('clientSecret', { type: 'string' });
    },
    saveFile
  )
  .demandCommand()
  .help()
  .parse();
