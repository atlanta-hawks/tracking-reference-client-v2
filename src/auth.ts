import axios, { AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import { tmpdir } from 'os';

const CLIENT_ID = 'YOUR CLIENT ID';
const CLIENT_SECRET = 'YOUR CLIENT SECRET';

const HOME_DIR =
  process.env.HOME ||
  process.env.HOMEPATH ||
  process.env.USERPROFILE ||
  tmpdir();
const TOKEN_CACHE_DIR = process.env.SSI_TOKEN_CACHE || `${HOME_DIR}/.ssi/cache`;
const AUTH_DOMAIN = 'secondspectrum.auth0.com';

interface FetchTokenInput {
  clientId: string;
  clientSecret: string;
  audienceName: string;
  authDomain: string;
}

interface TokenRequest {
  token: string;
  expires: number;
}

fs.mkdirSync(TOKEN_CACHE_DIR, { recursive: true });

export async function get(audienceName: string): Promise<string> {
  const { clientId, clientSecret, authDomain } = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    authDomain: AUTH_DOMAIN
  };
  const key = getCacheKey(clientId, audienceName, authDomain);

  const tokenFile = `${TOKEN_CACHE_DIR}/${key}.json`;
  const fsToken = getFSToken(tokenFile);
  if (fsToken?.token && Date.now() / 1000.0 <= fsToken?.expires) {
    return fsToken.token;
  }

  try {
    const newToken = await fetchTokenClientCreds({
      clientId,
      clientSecret,
      audienceName,
      authDomain
    });

    const f = fs.openSync(tokenFile, 'w');
    fs.writeSync(f, JSON.stringify(newToken));
    fs.closeSync(f);
    return newToken.token;
  } catch (e) {
    throw new Error(
      `Could not fetch token for audience: ${audienceName} due to ${e}`
    );
  }
}

function getFSToken(tokenFile: string): TokenRequest | undefined {
  try {
    const tokenStr = fs.readFileSync(tokenFile, { encoding: 'utf8' });
    const token: TokenRequest = JSON.parse(tokenStr);
    return token;
  } catch {}
}

function getCacheKey(
  id: string,
  audienceName: string,
  authDomain: string
): string {
  return `${authDomain}:${id}:${audienceName}`;
}

interface TokenData {
  access_token: string;
  expires_in: number;
}

async function fetchTokenClientCreds(
  params: FetchTokenInput
): Promise<TokenRequest> {
  const { clientId: clientID, clientSecret, audienceName, authDomain } = params;
  var options: AxiosRequestConfig = {
    method: 'POST',
    url: `https://${authDomain}/oauth/token`,
    headers: { 'content-type': 'application/json' },
    data: {
      grant_type: 'client_credentials',
      client_id: clientID,
      client_secret: clientSecret,
      audience: audienceName
    }
  };

  const { data } = await axios.request<TokenData>(options);
  if (!data?.access_token) throw new Error('Token not found');

  return {
    token: data.access_token,
    expires: Date.now() / 1000.0 + data.expires_in
  };
}
