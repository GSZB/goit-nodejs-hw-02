// End-to-end check of every endpoint against a running server.
// Usage: npm run dev (in another terminal), then: npm run test:e2e
import "dotenv/config";
import jwt from "jsonwebtoken";

const BASE = process.env.BASE ?? "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log("  PASS", label); }
  else { fail++; console.log("  FAIL", label, extra !== undefined ? JSON.stringify(extra) : ""); }
};
async function call(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(BASE + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  return { status: r.status, json, text };
}
const sfx = Date.now().toString(36);
const u1 = { username: `ivan_${sfx}`, email: `ivan_${sfx}@example.com`, password: "secret123", name: "Іван" };
const u2 = { username: `petro_${sfx}`, email: `petro_${sfx}@example.com`, password: "secret456", name: "Петро" };

console.log("== Auth: register");
let r = await call("POST", "/auth/register", { body: u1 });
ok(r.status === 201, "register 201", r);
ok(r.json?.user && !("password" in r.json.user), "no password in response");
ok(r.json?.user?.username === u1.username && r.json.user.email === u1.email && r.json.user.name === u1.name && typeof r.json.user.id === "number", "user fields");
ok(typeof r.json?.accessToken === "string" && typeof r.json?.refreshToken === "string", "token pair returned");
let { accessToken: a1, refreshToken: rt1 } = r.json;
r = await call("POST", "/auth/register", { body: { ...u1, email: `other_${sfx}@e.com` } });
ok(r.status === 409 && r.json?.error === "Username or email already taken", "duplicate username 409", r);
r = await call("POST", "/auth/register", { body: { ...u1, username: `other_${sfx}` } });
ok(r.status === 409, "duplicate email 409", r);
r = await call("POST", "/auth/register", { body: { username: "ab", email: "bad", password: "123", name: "A" } });
ok(r.status === 400 && r.json?.details?.body?.length === 4, "register validation 400 with 4 details", r.json);
r = await call("POST", "/auth/register", { body: {} });
ok(r.status === 400, "register empty body 400");
r = await call("POST", "/auth/register", { raw: "{bad json" , body: undefined });
r = await fetch(BASE + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" });
ok(r.status === 400, "malformed JSON 400");
r = await call("POST", "/auth/register", { body: { ...u1, username: "x".repeat(31), email: `x_${sfx}@e.com` } });
ok(r.status === 400, "username > 30 chars 400");

console.log("== Auth: login");
r = await call("POST", "/auth/login", { body: { username: u1.username, password: "wrong!!" } });
ok(r.status === 401 && r.json?.error === "Invalid credentials", "wrong password 401", r);
const msgWrongPass = r.json?.error;
r = await call("POST", "/auth/login", { body: { username: "nobody_" + sfx, password: "whatever" } });
ok(r.status === 401 && r.json?.error === msgWrongPass, "unknown user 401 same message", r);
r = await call("POST", "/auth/login", { body: { username: u1.username, password: u1.password } });
ok(r.status === 200 && r.json?.accessToken && r.json?.refreshToken && !("password" in r.json.user), "login 200 with tokens", r);
const rtLogin = r.json.refreshToken; a1 = r.json.accessToken;
// old refresh token (from register) must be replaced -> no longer valid
r = await call("POST", "/auth/refresh", { body: { refreshToken: rt1 } });
ok(r.status === 401, "old refresh token replaced after login -> 401", r);

console.log("== Auth: refresh");
r = await call("POST", "/auth/refresh", { body: { refreshToken: rtLogin } });
ok(r.status === 200 && r.json?.accessToken && r.json?.refreshToken && Object.keys(r.json).length === 2, "refresh 200 returns pair", r);
const rt2 = r.json.refreshToken; a1 = r.json.accessToken;
ok(rt2 !== rtLogin, "new refresh token differs");
r = await call("POST", "/auth/refresh", { body: { refreshToken: rtLogin } });
ok(r.status === 401, "rotation: reused old token -> 401", r);
r = await call("POST", "/auth/refresh", { body: { refreshToken: "not.a.jwt" } });
ok(r.status === 401, "invalid signature -> 401");
const parts = rt2.split("."); const tampered = parts[0] + "." + parts[1] + "." + parts[2].slice(0, -3) + "abc";
r = await call("POST", "/auth/refresh", { body: { refreshToken: tampered } });
ok(r.status === 401, "tampered signature -> 401");
r = await call("POST", "/auth/refresh", { body: { refreshToken: a1 } });
ok(r.status === 401, "access token used as refresh -> 401");
r = await call("POST", "/auth/refresh", { body: {} });
ok(r.status === 400, "refresh missing token -> 400");

console.log("== Auth: me");
r = await call("GET", "/auth/me");
ok(r.status === 401, "me without token 401");
r = await call("GET", "/auth/me", { token: "garbage" });
ok(r.status === 401, "me invalid token 401");
r = await call("GET", "/auth/me", { token: rt2 });
ok(r.status === 401, "me with refresh token 401");
r = await fetch(BASE + "/auth/me", { headers: { Authorization: `Token ${a1}` } });
ok(r.status === 401, "me wrong scheme 401");
r = await call("GET", "/auth/me", { token: a1 });
ok(r.status === 200 && r.json?.username === u1.username && r.json?.createdAt && !("password" in r.json), "me 200 without password", r);
ok(JSON.stringify(Object.keys(r.json).sort()) === JSON.stringify(["createdAt","email","id","name","username"]), "me exact fields", Object.keys(r.json));

console.log("== Expired token");
const expired = jwt.sign({ sub: 1, username: "x", type: "access" }, process.env.JWT_SECRET, { expiresIn: -10 });
r = await call("GET", "/auth/me", { token: expired });
ok(r.status === 401 && r.json?.error === "Token expired", "expired token 401", r);

console.log("== Second user");
r = await call("POST", "/auth/register", { body: u2 });
ok(r.status === 201, "register u2");
const a2 = r.json.accessToken;

console.log("== Announcements: create");
const ann = { title: "Продам велосипед", description: "Гірський велосипед, 21 швидкість", price: 8000, category: "sale" };
r = await call("POST", "/announcements", { body: ann });
ok(r.status === 401, "create without token 401");
r = await call("POST", "/announcements", { body: { ...ann, userId: 999999 }, token: a1 });
ok(r.status === 201, "create 201", r);
const meId = (await call("GET", "/auth/me", { token: a1 })).json.id;
ok(r.json?.user?.id === meId, "userId taken from token (ignores body userId)", r.json?.user);
ok(r.json && !("userId" in r.json) && r.json.createdAt && r.json.updatedAt && r.json.price === 8000 && r.json.category === "sale", "create response shape", r.json);
ok(r.json?.user && !("password" in r.json.user), "author without password");
const annId = r.json.id;
r = await call("POST", "/announcements", { body: { title: "abc", description: "short", price: 0, category: "car" }, token: a1 });
ok(r.status === 400 && r.json?.details?.body?.length === 4, "create validation: all 4 fields checked", r.json);
r = await call("POST", "/announcements", { body: { ...ann, price: "8000" }, token: a1 });
ok(r.status === 400, "price as string 400");
r = await call("POST", "/announcements", { body: { ...ann, price: -5 }, token: a1 });
ok(r.status === 400, "negative price 400");
r = await call("POST", "/announcements", { body: { ...ann, title: "x".repeat(51) }, token: a1 });
ok(r.status === 400, "title > 50 400");

console.log("== Announcements: get by id");
r = await call("GET", `/announcements/${annId}`);
ok(r.status === 200 && r.json?.id === annId && r.json?.user?.username === u1.username, "get by id 200 with author", r);
r = await call("GET", `/announcements/99999999`);
ok(r.status === 404, "non-existing id 404", r);
r = await call("GET", `/announcements/abc`);
ok(r.status === 400 && r.json?.details?.params, "invalid id 400 (params)", r.json);

console.log("== Announcements: patch");
r = await call("PATCH", `/announcements/${annId}`, { body: { price: 6500 } });
ok(r.status === 401, "patch without token 401");
r = await call("PATCH", `/announcements/${annId}`, { body: {}, token: a1 });
ok(r.status === 400, "patch empty {} 400", r.json);
r = await call("PATCH", `/announcements/${annId}`, { body: { foo: "bar" }, token: a1 });
ok(r.status === 400, "patch only unknown fields 400");
r = await call("PATCH", `/announcements/${annId}`, { body: { price: -1 }, token: a1 });
ok(r.status === 400, "patch invalid price 400");
r = await call("PATCH", `/announcements/${annId}`, { body: { title: "Чужа зміна" }, token: a2 });
ok(r.status === 403 && r.json?.error === "Access denied", "patch someone else's -> 403", r);
const before = (await call("GET", `/announcements/${annId}`)).json;
await new Promise((res) => setTimeout(res, 20));
r = await call("PATCH", `/announcements/${annId}`, { body: { title: "Продам велосипед терміново", price: 6500 }, token: a1 });
ok(r.status === 200 && r.json?.title === "Продам велосипед терміново" && r.json?.price === 6500 && r.json?.description === ann.description, "patch partial 200", r);
ok(new Date(r.json.updatedAt) > new Date(before.updatedAt) && r.json.createdAt === before.createdAt, "updatedAt changes automatically", [before.updatedAt, r.json.updatedAt]);
r = await call("PATCH", `/announcements/99999999`, { body: { price: 1 }, token: a1 });
ok(r.status === 404, "patch non-existing 404");

console.log("== Announcements: list");
// create 23 more for pagination/search/sort
for (let i = 1; i <= 23; i++) {
  await call("POST", "/announcements", { token: i % 2 ? a1 : a2, body: { title: `Lot ${sfx} #${String(i).padStart(2, "0")} ${i % 5 === 0 ? "Ноутбук ASUS" : "item"}`, description: "Опис оголошення довгий", price: 100 + i, category: "other" } });
}
r = await call("GET", "/announcements");
ok(r.status === 200 && Array.isArray(r.json?.data), "list 200 with data array");
ok(r.json?.pagination && ["total","page","totalPages","perPage"].every((k) => typeof r.json.pagination[k] === "number"), "pagination fields", r.json?.pagination);
ok(r.json.data.length === 10 && r.json.pagination.perPage === 10 && r.json.pagination.page === 1, "10 items per page");
ok(r.json.pagination.totalPages === Math.ceil(r.json.pagination.total / 10), "totalPages correct");
const newest = r.json.data.map((a) => a.createdAt);
ok(newest.every((d, i) => i === 0 || d <= newest[i - 1]), "default sort newest (desc)");
r = await call("GET", `/announcements?search=${encodeURIComponent("lot " + sfx)}&page=3`);
ok(r.status === 200 && r.json.pagination.total === 23 && r.json.pagination.totalPages === 3 && r.json.data.length === 3 && r.json.pagination.page === 3, "search + page 3 (3 of 23)", r.json.pagination);
r = await call("GET", `/announcements?search=${encodeURIComponent("НОУТБУК asus")}`);
ok(r.status === 200 && r.json.data.length >= 4 && r.json.data.every((a) => a.title.toLowerCase().includes("ноутбук asus")), "case-insensitive search", r.json.data.map((a) => a.title));
r = await call("GET", `/announcements?search=${encodeURIComponent("lot " + sfx)}&sort=oldest`);
ok(r.json.data[0].title.includes("#01") && r.json.data[9].title.includes("#10"), "sort=oldest asc", r.json.data.map((a) => a.title));
r = await call("GET", `/announcements?search=${encodeURIComponent("lot " + sfx)}&sort=newest`);
ok(r.json.data[0].title.includes("#23"), "sort=newest desc");
r = await call("GET", `/announcements?search=`);
const all = r.json.pagination.total;
r = await call("GET", `/announcements`);
ok(all === r.json.pagination.total, "empty search returns all");
r = await call("GET", `/announcements?page=0`);
ok(r.status === 400 && r.json?.details?.query, "page=0 -> 400 (query)", r.json);
r = await call("GET", `/announcements?page=abc`);
ok(r.status === 400, "page=abc -> 400");
r = await call("GET", `/announcements?sort=random`);
ok(r.status === 400, "sort=random -> 400");
r = await call("GET", `/announcements?search=${encodeURIComponent("zzz_no_match_" + sfx)}`);
ok(r.status === 200 && r.json.data.length === 0 && r.json.pagination.total === 0 && r.json.pagination.totalPages === 0, "no matches -> empty", r.json);

console.log("== Announcements: delete");
r = await call("DELETE", `/announcements/${annId}`);
ok(r.status === 401, "delete without token 401");
r = await call("DELETE", `/announcements/${annId}`, { token: a2 });
ok(r.status === 403 && r.json?.error === "Access denied", "delete someone else's -> 403", r);
r = await call("DELETE", `/announcements/${annId}`, { token: a1 });
ok(r.status === 204 && r.text === "", "delete 204 without body", r);
r = await call("GET", `/announcements/${annId}`);
ok(r.status === 404, "deleted -> 404");
r = await call("DELETE", `/announcements/${annId}`, { token: a1 });
ok(r.status === 404, "delete again -> 404");

console.log("== Auth: logout");
r = await call("POST", "/auth/logout");
ok(r.status === 401, "logout without token 401");
r = await call("POST", "/auth/logout", { token: a1 });
ok(r.status === 204 && r.text === "", "logout 204 no body", r);
r = await call("POST", "/auth/refresh", { body: { refreshToken: rt2 } });
ok(r.status === 401, "refresh after logout -> 401 (token deleted)");
r = await call("POST", "/auth/logout", { token: a1 });
ok(r.status === 204, "logout again still 204 (deleteMany)");

console.log("== OpenAPI");
r = await fetch(BASE + "/api-docs/");
const html = await r.text();
ok(r.status === 200 && html.includes("swagger"), "/api-docs page opens");
const doc = (await call("GET", "/api-docs.json")).json;
const paths = doc.paths ?? {};
const expected = [["post","/auth/register"],["post","/auth/login"],["post","/auth/refresh"],["post","/auth/logout"],["get","/auth/me"],["get","/announcements"],["get","/announcements/{id}"],["post","/announcements"],["patch","/announcements/{id}"],["delete","/announcements/{id}"]];
ok(expected.every(([m,p]) => paths[p]?.[m]), "all 10 routes documented", Object.keys(paths));
ok(doc.components?.securitySchemes?.bearerAuth?.scheme === "bearer", "bearerAuth scheme registered");
const protectedRoutes = [["post","/auth/logout"],["get","/auth/me"],["post","/announcements"],["patch","/announcements/{id}"],["delete","/announcements/{id}"]];
ok(protectedRoutes.every(([m,p]) => paths[p][m].security?.[0]?.bearerAuth), "protected routes have bearerAuth (lock)");
const publicRoutes = expected.filter(([m,p]) => !protectedRoutes.some(([m2,p2]) => m2===m && p2===p));
ok(publicRoutes.every(([m,p]) => !paths[p][m].security), "public routes have no lock");

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
