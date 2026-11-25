import test from 'node:test';
import assert from 'node:assert/strict';
import { reportInput } from '../src/services/reportPolicy.js';
import { bootstrapAllowed } from '../src/services/adminPolicy.js';

test('M9 Google bootstrap accepts only verified ROOT allowlisted email, never profile.email',()=>{
  const old=process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS='  Owner@EXAMPLE.com ';
  try {
    assert.equal(bootstrapAllowed({id:'a',guest:false,identity_verified:true,email:'owner@example.com'}),true);
    assert.equal(bootstrapAllowed({id:'a',guest:false,identity_verified:false,email:'owner@example.com'}),false);
    assert.equal(bootstrapAllowed({id:'a',guest:false,identity_verified:true,profile:{email:'owner@example.com'}}),false);
    assert.equal(bootstrapAllowed({id:'a',guest:true,identity_verified:true,email:'owner@example.com'}),false);
  } finally {if(old===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=old;}
});

test('M4 verified Google reporting uses stable provider subject, not editable email/profile or user id',()=>{
  const a={id:'one',guest:false,identity_verified:true,google_sub:'verified-provider-subject',role:'consumer'};
  const b={...a,id:'recreated',email:'new@example.com'};
  assert.equal(reportInput(a,{reason:'closed'}).reporterKey,reportInput(b,{reason:'closed'}).reporterKey);
  assert.throws(()=>reportInput({id:'c',guest:false,identity_verified:true},{reason:'closed'}),/ổn định/);
  assert.throws(()=>reportInput({id:'c',guest:false,profile:{identity_verified:true,google_sub:'forged'}},{reason:'closed'}),/xác minh/);
});

test('M4 stable REPORT_IDENTITY_KEY maintains voter identity during JWT signing-key rotation',()=>{
  const old={jwt:process.env.JWT_SECRET,report:process.env.REPORT_IDENTITY_KEY};
  const a={id:'one',guest:false,phone:'+84912345678',role:'consumer'};
  try {
    process.env.REPORT_IDENTITY_KEY='test-fixed-report-key';
    process.env.JWT_SECRET='before-token-key';
    const before=reportInput(a,{reason:'closed'}).reporterKey;
    process.env.JWT_SECRET='after-token-key';
    assert.equal(reportInput(a,{reason:'closed'}).reporterKey,before);
    assert.equal(before.length,64);
    assert.ok(!before.includes(a.phone));
  } finally {
    if(old.jwt===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=old.jwt;
    if(old.report===undefined)delete process.env.REPORT_IDENTITY_KEY;else process.env.REPORT_IDENTITY_KEY=old.report;
  }
});
