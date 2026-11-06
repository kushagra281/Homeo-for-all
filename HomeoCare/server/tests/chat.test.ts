// Run: tsx server/tests/chat.test.ts
// The community chat: joining twice must not repeat the "joined" notice, and chat rules still hold.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { initializeWebSocket } from "../websocket";

const server = createServer();
initializeWebSocket(server);

server.listen(0, async () => {
  const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws/chat`;
  const open = (inbox: any[]) => new Promise<WebSocket>((resolve) => {
    const ws = new WebSocket(url);
    ws.on("message", (d) => inbox.push(JSON.parse(d.toString())));
    ws.on("open", () => resolve(ws));
  });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const send = (ws: WebSocket, o: unknown) => ws.send(JSON.stringify(o));
  const notices = (inbox: any[]) => inbox.filter((m) => m.type === "message" && m.messageType === "system").map((m) => m.message);
  try {
    const bobIn: any[] = [], evaIn: any[] = [];
    const bob = await open(bobIn), eva = await open(evaIn);
    send(bob, { type: "join", username: "Bob" }); await wait(150);
    bobIn.length = 0;

    for (let i = 0; i < 20; i++) send(eva, { type: "join", username: "Eva" + i });
    await wait(400);
    assert.deepEqual(notices(bobIn), ["Eva0 joined the chat"], "only the first join counts");
    console.log("ok   a connection that joins again is ignored (no flood of notices)");

    bobIn.length = 0;
    send(eva, { type: "message", message: "hello" }); await wait(150);
    const said = bobIn.filter((m) => m.type === "message" && m.messageType === "message");
    assert.equal(said.length, 1);
    assert.equal(said[0].username, "Eva0");
    console.log("ok   the name chosen at the first join is kept for messages");

    bobIn.length = 0;
    send(bob, { type: "join", username: "system" }); await wait(100);
    const carl = await open([]);
    send(carl, { type: "join", username: "Admin" }); await wait(100);
    assert.deepEqual(notices(bobIn), [], "reserved names cannot join");
    console.log("ok   reserved names are still refused");

    console.log("\n3 checks passed (chat)");
    server.close(); process.exit(0);
  } catch (e) {
    console.error("FAIL", e); server.close(); process.exit(1);
  }
});
