const { execSync } = require('child_process');
const dotenv = require('dotenv');
var fs = require('fs');
var path = require('path');
const stream = require('stream');

const { Storage: GoogleStorage } = require('@google-cloud/storage');

const { version: currentVersion } = require('../package.json');

const [, , nextVersionArg] = process.argv;

const nextVersion = nextVersionArg.startsWith('v')
	? nextVersionArg.substring(1)
	: nextVersionArg;

dotenv.config();

const BASE_VERSION = '0.1.0';
const TAG = '-hawks.';

const BIN_NAME = '2s';
const BIN_PREFIX = BIN_NAME + '-';

const DIR_BIN = 'lib/bin';
const FILE_MANIFEST = 'manifest.json';

const DRY_RUN = false;

(async () => {
	const storage = new GoogleStorage();

	const bucketName = process.env.RELEASE_BUCKET || '';
	if (!bucketName) {
		console.log('must set the bucket name in the environment');
		process.exit(1);
	}
	const bucket = storage.bucket(bucketName);
	const manifest = bucket.file(FILE_MANIFEST);

	const { current = {} } = await manifest.download();

	if (!!current?.version && currentVersion !== current?.version) {
		console.log(
			'the manifest is out of date with package.json, you must fix this before proceeding'
		);
		process.exit(1);
	}

	if (!!current?.version && currentVersion === nextVersion) {
		console.log('versions the same, skipping');
		process.exit(0);
	}

	if (!currentVersion.startsWith(BASE_VERSION)) {
		console.log(
			`the base version has changed from ${BASE_VERSION}, the publish script needs updating`
		);
		process.exit(1);
	}

	if (currentVersion.indexOf(TAG) < 0) {
		console.log(
			`the tag has changed from ${TAG}, the publish script needs updating`
		);
		process.exit(1);
	}

	if (!nextVersion.startsWith(BASE_VERSION)) {
		console.log(
			`the next version, ${nextVersion}, must include the base version: ${BASE_VERSION}`
		);
		process.exit(1);
	}

	if (nextVersion.indexOf(TAG) < 0) {
		console.log(`the next version must include the tag: ${TAG}`);
		process.exit(1);
	}

	console.log('packing bin');
	execSync('yarn pkg', { stdio: 'inherit' });

	const nextReleases =
		(!!current?.version
			? [current, ...manifest.releases]
			: current?.releases) || [];

	const nextManifest = {
		current: {
			version: nextVersion,
			links: {}
		},
		releases: nextReleases
	};

	const files = fs.readdirSync(DIR_BIN);

	for (let file of files) {
		const localPath = `${DIR_BIN}/${file}`;

		if (!file.startsWith(BIN_PREFIX)) {
			console.log(
				`the binary name has changed from ${BIN_NAME}, the publish script needs updating`
			);
			process.exit(1);
		}

		const [os, arch] = file
			.substring(BIN_PREFIX.length, file.length)
			.replace('.exe', '')
			.split('-');

		const tag = `${os}_${arch}`;
		const binName = tag + (os === 'win' ? '.exe' : '');

		const currentPath = `current/${binName}`;
		const releasePath = `releases/${nextVersion}/${binName}`;

		if (DRY_RUN) {
			console.log('not uploading: ' + currentPath);
		} else {
			console.log('uploading: ' + currentPath);
			await bucket.upload(localPath, { destination: currentPath });
		}

		if (DRY_RUN) {
			console.log('not uploading: ' + releasePath);
		} else {
			console.log('uploading: ' + releasePath);
			await bucket.upload(localPath, { destination: releasePath });
		}
		nextManifest.current.links[tag] = releasePath;
	}

	if (DRY_RUN) {
		console.log('not updating manifest.json');
		console.log(nextManifest);
	} else {
		console.log('updating manifest.json');
		const passthroughStream = new stream.PassThrough();
		passthroughStream.write(JSON.stringify(nextManifest, null, 2));
		passthroughStream.end();

		await passthroughStream
			.pipe(manifest.createWriteStream())
			.on('finish', () => {
				console.log('done.');
			});
	}
})();
