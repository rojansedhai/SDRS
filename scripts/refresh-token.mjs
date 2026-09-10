#!/usr/bin/env node
/**
 * Quick script to authenticate testuser@sdrs.internal with Cognito
 * and write the fresh JWT token to frontend/.env
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../frontend/.env');
let envContent = readFileSync(envPath, 'utf8');

const clientIdMatch = envContent.match(/VITE_COGNITO_CLIENT_ID=(.*)/);
const poolIdMatch = envContent.match(/VITE_COGNITO_USER_POOL_ID=(.*)/);

const clientId = clientIdMatch ? clientIdMatch[1].trim() : 'tdtqm22es47p0244be0goocbg';
const poolId = poolIdMatch ? poolIdMatch[1].trim() : 'us-east-1_2noP8Q7QM';
const region = poolId.split('_')[0] || 'us-east-1';

const username = process.env.COGNITO_USERNAME || 'testuser@sdrs.internal';
const password = process.env.COGNITO_PASSWORD;

if (!password) {
  console.error('[Error] COGNITO_PASSWORD environment variable is not set.');
  console.error('Usage: COGNITO_PASSWORD="<password>" [COGNITO_USERNAME="<user>"] node scripts/refresh-token.mjs');
  process.exit(1);
}

console.log(`[Auth] Authenticating "${username}" against Cognito in ${region}...`);

const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-amz-json-1.1',
    'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
  },
  body: JSON.stringify({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password
    }
  })
});

const data = await response.json();
if (!response.ok) {
  console.error('[Error] Authentication failed:', data.message || data);
  process.exit(1);
}

const idToken = data.AuthenticationResult?.IdToken;
if (!idToken) {
  console.error('[Error] No IdToken returned.');
  process.exit(1);
}

// Update .env file
if (envContent.includes('VITE_AUTH_TOKEN=')) {
  envContent = envContent.replace(/VITE_AUTH_TOKEN=.*/, `VITE_AUTH_TOKEN=${idToken}`);
} else {
  envContent += `\nVITE_AUTH_TOKEN=${idToken}\n`;
}

writeFileSync(envPath, envContent, 'utf8');
console.log('Successfully acquired fresh Cognito JWT IdToken!');
console.log(`Updated: ${envPath}`);
console.log(`Expires in: ${data.AuthenticationResult.ExpiresIn} seconds (1 hour)`);
