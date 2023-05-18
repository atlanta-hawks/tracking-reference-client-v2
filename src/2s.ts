import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'graceful-fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { CLIENT_ID, CLIENT_SECRET, get } from './auth';

dotenv.config();

const storage = new Storage();

const bucketName = process.env.SSI_BUCKET_NAME || '__not_a_bucket__';
const bucket = (flagBucketName?: string) =>
  storage.bucket(flagBucketName || bucketName);

async function getToken(id?: string, secret?: string): Promise<string> {
  try {
    return await get(
      'hermes-api-external.prod',
      id || CLIENT_ID,
      secret || CLIENT_SECRET
    );
  } catch (err) {
    console.error('reqest failed', err);
    throw new Error('Failed to authenticate request. Contact support.');
  }
}

type CommonOptKeys = 'baseUrl' | 'clientId' | 'clientSecret';
type CommonOpts = Pick<SaveOpts, CommonOptKeys>;

async function getMappingFile(
  file: string,
  competitionId: string,
  useStream?: boolean,
  opts: CommonOpts = {}
) {
  return getFile(
    `/competitiondata/ssi/${file}.json?competitionId=${competitionId}`,
    useStream,
    opts
  );
}

async function getGameFile(
  file: string,
  gameId: string,
  useStream?: boolean,
  opts: CommonOpts = {}
) {
  return getFile(
    `/gamedata/ssi/${file}.json?gameId=${gameId}`,
    useStream,
    opts
  );
}

async function getFile(
  path: string,
  useStream?: boolean,
  {
    baseUrl = process.env.SSI_BASE_URL || '',
    clientId,
    clientSecret,
  }: Partial<Pick<SaveOpts, 'baseUrl' | 'clientId' | 'clientSecret'>> = {}
) {
  const token = await getToken(clientId, clientSecret);

  return axios.get(baseUrl + path, {
    ...(useStream ? { responseType: 'stream' } : {}),
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      authorization: `Bearer ${token}`,
    },
  });
}

interface SaveOpts {
  id: string;
  file: string;
  path?: string;
  local?: boolean;
  baseUrl?: string;
  bucketName?: string;
  clientId?: string;
  clientSecret?: string;
}

async function saveFile({ id, file, path, local, ...rest }: SaveOpts) {
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
    if (file === 'events' || file === 'tracking') {
      ext = '.jsonl';
    }
  } else {
    throw new Error('invalid file name');
  }

  let res: any;
  if (isMappingFile) {
    res = await getMappingFile(file, id, !local, rest);
  } else {
    res = await getGameFile(file, id, !local, rest);
  }

  const dir = path || id;
  const filename = file + ext;

  if (!local) {
    const w = bucket(bucketName)
      .file(`${dir}/${filename}`)
      .createWriteStream({ contentType: 'application/json' });
    res.data.pipe(w);
  } else {
    fs.mkdirSync(dir, { recursive: true });

    const f = fs.openSync(`${dir}/${filename}`, 'w');
    fs.writeSync(f, JSON.stringify(res.data));
  }
}

yargs(hideBin(process.argv))
  .scriptName('second-spectrum')
  .command(
    'save_file',
    "save one of second spectrum's data files: [games, players, teams, advanced_box, events, markings, tracking]",
    (yargs_) => {
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
