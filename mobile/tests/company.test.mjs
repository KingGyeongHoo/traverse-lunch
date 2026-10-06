import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

for (const existing of [false, true]) {
  test(`company startup shares one workspace and preserves data (existing=${existing})`, async (t) => {
    const db = new PGlite();
    t.after(() => db.close());
    const users = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ];
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
    `);
    for (const user of users)
      await db.query("insert into auth.users values ($1)", [user]);
    const apply = async (name) =>
      db.exec(
        await readFile(
          new URL("../../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    await apply("202609280001_lunch.sql");
    const asUser = async (user, role = "authenticated") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        user,
      ]);
      await db.exec("set role " + role);
    };
    const call = async (sql, args = []) =>
      (await db.query(sql, args)).rows[0].value;
    let old;
    if (existing) {
      await asUser(users[0]);
      old = await call("select public.lunch_create_team('기존 회사') as value");
      await call("select public.lunch_mutate($1, 'save', $2::jsonb) as value", [
        old.id,
        JSON.stringify({
          input: {
            name: "기존 국밥집",
            category: "한식",
            distance: "가까움",
            note: "",
            closedDays: [],
          },
        }),
      ]);
    }
    await db.exec("reset role");
    await apply("202609280002_company_workspace.sql");
    await asUser(users[0]);
    const first = await call("select public.lunch_open_company() as value");
    if (old) assert.equal(first.id, old.id);
    assert.equal(first.inviteCode, undefined);
    await asUser(users[1]);
    const second = await call("select public.lunch_open_company() as value");
    assert.deepEqual(second, first);
    assert.deepEqual(
      await call("select public.lunch_open_company() as value"),
      first,
    );
    const snapshot = await call("select public.lunch_snapshot($1) as value", [
      first.id,
    ]);
    assert.equal(snapshot.restaurants.length, existing ? 1 : 0);
    if (existing) assert.equal(snapshot.restaurants[0].name, "기존 국밥집");
    await assert.rejects(
      db.query("select * from lunch_private.company_workspace"),
      /permission denied/,
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int as n from public.lunch_teams"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from public.lunch_members"))
        .rows[0].n,
      2,
    );
    await asUser("", "anon");
    await assert.rejects(
      call("select public.lunch_open_company() as value"),
      /permission denied/,
    );
  });
}
