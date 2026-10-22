import {test,expect} from '@playwright/test';
const good={sampleId:'SYN-999',fragmentLength:1250,signalQuality:0.91,variantCount:1};
test('API-001 samples are listed',async({request})=>{const r=await request.get('/api/samples');expect(r.status()).toBe(200);expect((await r.json()).length).toBe(3)});
test('API-002 rejects negative fragment lengths',async({request})=>{const r=await request.post('/api/analyze',{data:{...good,fragmentLength:-1}});expect(r.status()).toBe(422)});
test('API-003 rejects out-of-range quality',async({request})=>{const r=await request.post('/api/analyze',{data:{...good,signalQuality:1.4}});expect(r.status()).toBe(422)});
test('API-004 rejects missing sample ID',async({request})=>{const {sampleId,...rest}=good;const r=await request.post('/api/analyze',{data:rest});expect(r.status()).toBe(422)});
test('API-005 applies quality boundary correctly',async({request})=>{for(const [q,expected] of [[0.8,'PASS'],[0.79,'REVIEW']] as const){const r=await request.post('/api/analyze',{data:{...good,signalQuality:q}});expect(r.status()).toBe(200);expect((await r.json()).qcStatus).toBe(expected)}});
test('API-006 audit captures an analysis event',async({request})=>{const r=await request.post('/api/analyze',{data:good});expect(r.status()).toBe(200);const audit=await(await request.get('/api/audit')).json();expect(audit.some((e:any)=>e.sampleId===good.sampleId&&e.action==='ANALYZE'&&e.timestamp)).toBeTruthy()});
test('API-007 responses do not expose patient identifiers',async({request})=>{const body=await(await request.get('/api/samples')).text();expect(body).not.toMatch(/patientName|dateOfBirth|ssn|medicalRecordNumber/i)});
