/** Last Modified: 2026-10-17. Host protocol identity, late joining and cleanup. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { Session } from '../src/network/Session.js';
const packs = ['littleton', 'golden-hour'].map(id => JSON.parse(readFileSync(new URL(`../public/packs/${id}.json`, import.meta.url))));

/** A transport double that preserves actual JSON wire encoding. */
class Connection extends EventEmitter {
  /** Create an open uniquely identified connection. */
  constructor(peer) { super(); this.peer = peer; this.open = true; this.sent = []; }
  /** Record parsed JSON just as a remote receiver would read it. */
  send(value) { assert.equal(typeof value, 'string'); this.sent.push(JSON.parse(value)); }
  /** Deliver client-originated JSON to host listeners. */
  message(value) { this.emit('data', JSON.stringify(value)); }
  /** Close the transport and trigger its lifecycle event. */
  close() { this.open = false; this.emit('close'); }
}

test('host sends complete metadata and late-join snapshots over JSON messages', async () => {
  const s = new Session(); await s.host(packs, 'littleton', 'Host', 0, false);
  try { const c = new Connection('remote'); s.accept(c); c.message({ type:'hello', name:'Guest', color:2 }); const welcome=c.sent.find(m=>m.type==='welcome'); assert.equal(welcome.id,'guest-remote'); assert.equal(welcome.packs.length,2); assert.equal(welcome.snapshot.players['guest-remote'].gold,50); assert.ok(JSON.stringify(welcome).length>16000); } finally { s.close(); }
});
test('client actions and chat cannot forge another player identity or balance', async () => {
  const s = new Session(); await s.host(packs, 'littleton', 'Host', 0, false);
  try { const c=new Connection('host'); s.accept(c); c.message({type:'hello',name:'Guest'}); c.message({type:'action',id:'host',action:{verb:'drop',item:'littleton/apple'}}); assert.equal(s.world.players.host.inventory['littleton/apple'],2); assert.equal(s.world.players['guest-host'].inventory['littleton/apple'],1); c.message({type:'input',input:{x:0,y:0,gold:99999}}); assert.equal(s.world.players['guest-host'].gold,50); c.message({type:'chat',name:'Host',text:'Test message'}); assert.equal(c.sent.find(m=>m.type==='chat'&&m.text==='Test message').name,'Guest'); c.message({type:'hello',name:'Replacement'}); assert.equal(s.world.players['guest-host'].name,'Guest'); c.close(); assert.equal(s.world.players['guest-host'],undefined); } finally { s.close(); }
});
test('host closure ends a client once and clears every resource', () => {
  const client = new Session(); client.active=true; let ended=0; client.addEventListener('ended',()=>ended++); client.hostLost(); client.hostLost(); assert.equal(ended,1); assert.equal(client.active,false); assert.equal(client.peer,null); assert.equal(client.connection,null);
});
