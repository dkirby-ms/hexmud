#!/usr/bin/env tsx

import { argv, exit, stdin } from 'node:process';

import { getOpenIdConfiguration, OpenIdConfigurationError } from '../src/auth/openidConfiguration.js';
import { validateAccessToken, AccessTokenValidationError } from '../src/auth/validateToken.js';
import { env } from '../src/config/env.js';

const readTokenFromStdin = async (): Promise<string | undefined> => {
	if (stdin.isTTY) {
		return undefined;
	}

	const chunks: Buffer[] = [];
	for await (const chunk of stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	const token = Buffer.concat(chunks).toString('utf8').trim();
	return token.length > 0 ? token : undefined;
};

const main = async () => {
	const tokenArg = argv[2]?.trim();
	const token = tokenArg && tokenArg.length > 0 ? tokenArg : await readTokenFromStdin();

	if (!token) {
		console.error('Usage: pnpm --filter server exec tsx scripts/verifyToken.ts <access-token>');
		console.error('       cat token.txt | pnpm --filter server exec tsx scripts/verifyToken.ts');
		exit(1);
	}

	const { msal } = env;

	if (!msal.apiAudience || !msal.authority) {
		console.error('MSAL configuration is incomplete. Ensure MSAL_API_AUDIENCE and MSAL_AUTHORITY are set.');
		exit(1);
	}

	try {
		const discovery = await getOpenIdConfiguration(msal.authority);
		const jwksUri = discovery.jwks_uri ?? msal.jwksUri;

		if (!jwksUri) {
			console.error('Unable to determine JWKS URI from discovery. Set MSAL_JWKS_URI as a fallback.');
			exit(2);
		}

		const claims = await validateAccessToken(token, {
			jwksUri,
			audience: msal.apiAudience,
			issuer: discovery.issuer
		});

		console.log('Token is valid. Claims:');
		console.log(JSON.stringify(claims, null, 2));
	} catch (error) {
		if (error instanceof OpenIdConfigurationError) {
			console.error(`Failed to fetch OpenID configuration (${error.code}).`);
			console.error(error.message);
		} else if (error instanceof AccessTokenValidationError) {
			console.error(`Token validation failed. Reason: ${error.reason}`);
			console.error(error.message);
		} else if (error instanceof Error) {
			console.error('Token validation failed with unexpected error:');
			console.error(error.message);
		} else {
			console.error('Token validation failed with an unknown error.');
		}
		exit(2);
	}
};

await main();
