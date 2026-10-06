import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Supabase schema: team sharing, isolation, CRUD, exclusion and fair candidate selection", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const users = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
  `);
  for (const user of users)
    await db.query("insert into auth.users values ($1)", [user]);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/202609280001_lunch.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  async function asUser(user, role = "authenticated") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      user,
    ]);
    await db.exec(`set role ${role}`);
  }
  const call = async (sql, args = []) =>
    (await db.query(sql, args)).rows[0]?.value;
  const snapshot = (team) =>
    call("select public.lunch_snapshot($1) as value", [team]);
  const mutate = (team, action, payload) =>
    call("select public.lunch_mutate($1, $2, $3::jsonb) as value", [
      team,
      action,
      JSON.stringify(payload),
    ]);
  const input = (name, extras = {}) => ({
    name,
    category: "한식",
    distance: "가까움",
    note: "",
    closedDays: [],
    ...extras,
  });

  await asUser(users[0]);
  const first = await call(
    "select public.lunch_create_team('첫 번째 팀') as value",
  );
  let data = await mutate(first.id, "save", { input: input("국밥집") });
  const restaurantId = data.restaurants[0].id;
  assert.equal(data.restaurants[0].name, "국밥집");

  await asUser(users[1]);
  assert.equal(
    (await db.query("select * from public.lunch_teams")).rows.length,
    0,
    "non-member cannot read invite codes",
  );
  assert.equal(
    (await db.query("select * from public.lunch_restaurants")).rows.length,
    0,
  );
  await assert.rejects(snapshot(first.id), /이 팀에 참여/);
  await assert.rejects(
    mutate(first.id, "delete", { id: restaurantId }),
    /이 팀에 참여/,
  );
  await assert.rejects(
    db.query("insert into public.lunch_members values ($1, $2)", [
      first.id,
      users[1],
    ]),
    /permission denied/,
  );
  await assert.rejects(
    call("select public.lunch_join_team('bad') as value"),
    /초대 코드/,
  );
  const joined = await call("select public.lunch_join_team($1) as value", [
    first.inviteCode,
  ]);
  assert.equal(joined.id, first.id);
  assert.equal((await snapshot(first.id)).restaurants[0].name, "국밥집");
  await mutate(first.id, "save", {
    id: restaurantId,
    input: input("함께 수정한 국밥집"),
  });

  await asUser(users[0]);
  assert.equal(
    (await snapshot(first.id)).restaurants[0].name,
    "함께 수정한 국밥집",
    "member edit is shared",
  );
  data = await mutate(first.id, "exclude", {
    id: restaurantId,
    excludedToday: true,
  });
  assert.equal(data.restaurants[0].excludedDate, data.today);
  await assert.rejects(mutate(first.id, "pick", {}), /식당이 없어요/);
  await mutate(first.id, "exclude", { id: restaurantId, excludedToday: false });
  assert.equal(
    (await mutate(first.id, "pick", { distance: "가까움" })).picked.id,
    restaurantId,
  );

  await mutate(first.id, "save", {
    input: input("오늘 쉬는 집", { closedDays: [data.weekday] }),
  });
  await mutate(first.id, "save", {
    input: input("중간 거리", { distance: "중간" }),
  });
  await mutate(first.id, "save", { input: input("먼 곳", { distance: "멂" }) });
  await mutate(first.id, "save", {
    input: input("거리 모름", { distance: null }),
  });
  for (let count = 0; count < 8; count++) {
    assert.equal(
      (await mutate(first.id, "pick", { distance: "가까움" })).picked.id,
      restaurantId,
    );
    const mid = (await mutate(first.id, "pick", { distance: "중간" })).picked;
    assert.ok(["가까움", "중간"].includes(mid.distance));
    assert.ok(!mid.closedDays.includes(data.weekday));
  }
  await db.query(
    "update public.lunch_restaurants set excluded_date = $1::date - 1 where id = $2",
    [data.today, restaurantId],
  );
  assert.equal(
    (await mutate(first.id, "pick", { distance: "가까움" })).picked.id,
    restaurantId,
    "past exclusion no longer blocks picking",
  );
  await assert.rejects(
    mutate(first.id, "save", { input: input("") }),
    /check constraint/,
  );
  await assert.rejects(
    mutate(first.id, "save", {
      input: input("잘못된 휴무", { closedDays: [7] }),
    }),
    /check constraint/,
  );
  await assert.rejects(
    mutate(first.id, "pick", { distance: "invalid" }),
    /거리 조건/,
  );

  await asUser(users[2]);
  const second = await call(
    "select public.lunch_create_team('다른 팀') as value",
  );
  await assert.rejects(
    mutate(second.id, "delete", { id: restaurantId }),
    /식당을 찾을 수/,
  );
  await assert.rejects(
    mutate(second.id, "save", { id: restaurantId, input: input("침범") }),
    /식당을 찾을 수/,
  );
  await assert.rejects(
    db.query(
      "insert into public.lunch_restaurants(team_id,name,category) values ($1,$2,$3)",
      [first.id, "침범", "한식"],
    ),
    /row-level security/,
  );
  assert.equal((await snapshot(second.id)).restaurants.length, 0);

  await asUser(users[1]);
  await mutate(first.id, "delete", { id: restaurantId });
  assert.ok(
    !(await snapshot(first.id)).restaurants.some(
      (item) => item.id === restaurantId,
    ),
  );
  await asUser("", "anon");
  await assert.rejects(
    call("select public.lunch_create_team('비인증') as value"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select * from public.lunch_restaurants"),
    /permission denied/,
  );
});
