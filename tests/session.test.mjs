import test from 'node:test';import assert from 'node:assert/strict';import {tokenNeedsRefresh} from '../lib/rules.mjs';
const jwt=claims=>`header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
test('refresh proactively renews expired and nearly expired sessions',()=>{const now=1792420000000;assert.equal(tokenNeedsRefresh(jwt({exp:now/1000+3600}),now),false);for(const exp of [now/1000-1,now/1000+20,now/1000+60])assert.equal(tokenNeedsRefresh(jwt({exp}),now),true);});
test('missing and malformed session tokens never bypass renewal',()=>{for(const value of [undefined,'','invalid',jwt({}),jwt({exp:'not-a-date'})])assert.equal(tokenNeedsRefresh(value),true);});
