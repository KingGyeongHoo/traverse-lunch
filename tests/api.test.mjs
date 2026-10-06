import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { once } from "node:events";

test(
  "Route Handlers persist CRUD, serialize concurrent writes, and draw only eligible restaurants",
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lunch-api-test-"));
    const file = path.join(directory, "restaurants.json");
    const port = 32000 + Math.floor(Math.random() * 10000);
    const base = `http://127.0.0.1:${port}`;
    let logs = "";
    const server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          LUNCH_DATA_FILE: file,
          NEXT_TELEMETRY_DISABLED: "1",
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    server.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    async function api(route, method = "GET", body, expected = 200) {
      const response = await fetch(`${base}/api${route}`, {
        method,
        ...(body !== undefined
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
        signal: AbortSignal.timeout(15000),
      });
      const value = await response.json();
      assert.equal(response.status, expected, JSON.stringify(value));
      return value;
    }
    const input = (name, closedDays = []) => ({
      name,
      category: "한식",
      note: "테스트 메모",
      closedDays,
    });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(logs);
        try {
          const response = await fetch(`${base}/api/restaurants`);
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.ok(ready, logs);
      const empty = await api("/restaurants");
      assert.deepEqual(empty.restaurants, []);
      const located = await api(
        "/restaurants",
        "POST",
        {
          ...input("주소 등록 검증"),
          address: "서울 영등포구 양평로 12",
          latitude: 37.5326909883438,
          longitude: 126.90489166462,
          distance: "멂",
          distanceMeters: 9999,
        },
        201,
      );
      const locatedId = located.restaurants[0].id;
      assert.equal(located.restaurants[0].distanceMeters, 0);
      assert.equal(located.restaurants[0].distance, "가까움");
      const sameAddress = {
        ...input("주소등록 검증"),
        address: "서울 영등포구 양평로 12",
        latitude: 37.5326909883438,
        longitude: 126.90489166462,
      };
      await api("/restaurants", "POST", sameAddress, 409);
      const otherAddress = await api(
        "/restaurants",
        "POST",
        {
          ...sameAddress,
          address: "서울 영등포구 양평로 8",
          latitude: 37.5325527443156,
          longitude: 126.90507772707741,
        },
        201,
      );
      const otherId = otherAddress.restaurants.find(
        (item) => item.address === "서울 영등포구 양평로 8",
      ).id;
      await api(`/restaurants/${otherId}`, "PATCH", sameAddress, 409);
      await api(`/restaurants/${otherId}`, "DELETE");
      await api(`/restaurants/${locatedId}`, "PATCH", input("이름만 수정"));
      let locationReload = (await api("/restaurants")).restaurants[0];
      assert.equal(locationReload.address, "서울 영등포구 양평로 12");
      assert.equal(locationReload.distanceMeters, 0);
      await api(`/restaurants/${locatedId}`, "PATCH", {
        ...input("주소 이동"),
        address: "좌표 변경 검증",
        latitude: 37.5426909883438,
        longitude: 126.90489166462,
      });
      locationReload = (await api("/restaurants")).restaurants[0];
      assert.equal(locationReload.distanceMeters, 1112);
      assert.equal(locationReload.distance, "매우 멂");
      await api(`/restaurants/${locatedId}`, "PATCH", {
        ...input("주소 삭제"),
        address: "",
        latitude: null,
        longitude: null,
        distance: null,
      });
      locationReload = (await api("/restaurants")).restaurants[0];
      assert.equal(locationReload.distanceMeters, null);
      assert.equal(locationReload.address, "");
      await api(`/restaurants/${locatedId}`, "DELETE");
      await api("/pick", "POST", undefined, 409);
      await api("/restaurants", "POST", input(" "), 400);
      await api("/restaurants", "POST", input("잘못된 요일", [7]), 400);
      const malformed = await fetch(`${base}/api/restaurants`, {
        method: "POST",
        body: "{",
      });
      assert.equal(malformed.status, 400);

      await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          api("/restaurants", "POST", input(`동시 등록 ${index}`), 201),
        ),
      );
      let data = await api("/restaurants");
      assert.equal(
        data.restaurants.length,
        12,
        "No concurrent additions may be lost",
      );
      assert.equal(new Set(data.restaurants.map((item) => item.id)).size, 12);
      assert.deepEqual(
        JSON.parse(await readFile(file, "utf8")),
        data.restaurants,
        "Changes must be persisted to disk",
      );

      const first = data.restaurants[0];
      const duplicate = await api(
        "/restaurants",
        "POST",
        input(first.name.replaceAll(" ", "")),
        409,
      );
      assert.match(duplicate.error, /같은 주소와 이름/);
      await api(
        `/restaurants/${data.restaurants[1].id}`,
        "PATCH",
        input(first.name),
        409,
      );
      await api(`/restaurants/${first.id}`, "PATCH", input(first.name));
      const concurrentDuplicates = await Promise.all(
        Array.from({ length: 6 }, () =>
          fetch(`${base}/api/restaurants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input("Concurrent 중복")),
          }),
        ),
      );
      assert.deepEqual(
        concurrentDuplicates.map((response) => response.status).sort(),
        [201, 409, 409, 409, 409, 409],
      );
      const afterDuplicates = await api("/restaurants");
      const createdDuplicate = afterDuplicates.restaurants.find(
        (item) => item.name === "Concurrent 중복",
      );
      assert.equal(afterDuplicates.restaurants.length, 13);
      await api("/restaurants", "POST", input(" concurrent중복 "), 409);
      await api(`/restaurants/${createdDuplicate.id}`, "DELETE");
      await api(
        `/restaurants/${first.id}`,
        "PATCH",
        input("수정한 식당", [data.weekday]),
      );
      await api(`/restaurants/${data.restaurants[1].id}`, "PATCH", {
        excludedToday: true,
      });
      await api(
        `/restaurants/${first.id}`,
        "PATCH",
        { excludedToday: "true" },
        400,
      );
      await api("/restaurants/missing", "DELETE", undefined, 404);

      // Leave exactly one eligible restaurant to make the draw assertion deterministic.
      await Promise.all(
        data.restaurants
          .slice(2, -1)
          .map((item) =>
            api(`/restaurants/${item.id}`, "PATCH", { excludedToday: true }),
          ),
      );
      const eligible = data.restaurants.at(-1);
      const draws = await Promise.all(
        Array.from({ length: 15 }, () => api("/pick", "POST")),
      );
      for (const draw of draws) assert.equal(draw.picked.id, eligible.id);
      await api(`/restaurants/${eligible.id}`, "PATCH", {
        excludedToday: true,
      });
      await api("/pick", "POST", undefined, 409);
      await api(`/restaurants/${eligible.id}`, "PATCH", {
        excludedToday: false,
      });
      assert.equal((await api("/pick", "POST")).picked.id, eligible.id);

      data = await api("/restaurants");
      const closed = data.restaurants.find((item) => item.id === first.id);
      assert.equal(closed.name, "수정한 식당");
      assert.deepEqual(closed.closedDays, [data.weekday]);
      const excluded = data.restaurants.find(
        (item) => item.id === data.restaurants[1].id,
      );
      assert.equal(excluded.excludedDate, data.today);

      await Promise.all(
        data.restaurants.map((item) =>
          api(`/restaurants/${item.id}`, "DELETE"),
        ),
      );
      assert.deepEqual((await api("/restaurants")).restaurants, []);
      assert.deepEqual(JSON.parse(await readFile(file, "utf8")), []);

      // Legacy JSON remains readable without assigning an arbitrary distance.
      const legacy = {
        ...input("거리 없는 기존 식당"),
        id: "legacy",
        excludedDate: null,
      };
      await writeFile(file, JSON.stringify([legacy]), "utf8");
      assert.equal((await api("/restaurants")).restaurants[0].distance, null);
      assert.equal((await api("/pick", "POST")).picked.id, "legacy");
      assert.equal(
        (await api("/pick", "POST", { distance: "매우 멂" })).picked.id,
        "legacy",
      );
      await api("/pick", "POST", { distance: "가까움" }, 409);

      for (const distance of ["가까움", "중간", "멂", "매우 멂"]) {
        await api(
          "/restaurants",
          "POST",
          { ...input(`${distance} 식당`), distance },
          201,
        );
      }
      const byDistance = (await api("/restaurants")).restaurants;
      for (const distance of ["가까움", "중간", "멂", "매우 멂"]) {
        const draws = await Promise.all(
          Array.from({ length: 8 }, () => api("/pick", "POST", { distance })),
        );
        const allowed =
          distance === "가까움"
            ? ["가까움"]
            : distance === "중간"
              ? ["가까움", "중간"]
              : distance === "멂"
                ? ["가까움", "중간", "멂"]
                : ["가까움", "중간", "멂", "매우 멂", null];
        assert.ok(
          draws.every((draw) => allowed.includes(draw.picked.distance)),
        );
      }
      const near = byDistance.find((item) => item.distance === "가까움");
      const medium = byDistance.find((item) => item.distance === "중간");
      await api(`/restaurants/${medium.id}`, "PATCH", { excludedToday: true });
      assert.equal(
        (await api("/pick", "POST", { distance: "중간" })).picked.id,
        near.id,
        "Middle limit must include nearby restaurants",
      );
      await api(`/restaurants/${medium.id}`, "PATCH", { excludedToday: false });
      await api(`/restaurants/${near.id}`, "PATCH", { excludedToday: true });
      assert.equal(
        (await api("/pick", "POST", { distance: "중간" })).picked.id,
        medium.id,
      );
      await api("/pick", "POST", { distance: "가까움" }, 409);
      await api(`/restaurants/${near.id}`, "PATCH", { excludedToday: false });
      await api(
        `/restaurants/${near.id}`,
        "PATCH",
        input("가까운 휴무 식당", [empty.weekday]),
      );
      assert.equal(
        (await api("/restaurants")).restaurants.find(
          (item) => item.id === near.id,
        ).distance,
        "가까움",
        "Older clients must preserve stored distance",
      );
      await api("/pick", "POST", { distance: "가까움" }, 409);
      await api(`/restaurants/${near.id}`, "PATCH", {
        ...input("거리 변경 식당"),
        distance: "멂",
      });
      const persisted = JSON.parse(await readFile(file, "utf8"));
      assert.equal(
        persisted.find((item) => item.id === near.id).distance,
        "멂",
      );
      await api(`/restaurants/${near.id}`, "PATCH", {
        ...input("거리 초기화 식당"),
        distance: null,
      });
      assert.equal(
        (await api("/restaurants")).restaurants.find(
          (item) => item.id === near.id,
        ).distance,
        null,
      );
      await api(
        "/restaurants",
        "POST",
        { ...input("잘못된 거리"), distance: "unknown" },
        400,
      );
      for (const body of [
        null,
        [],
        { distance: "unknown" },
        { distance: null },
        { distance: ["가까움"] },
      ]) {
        await api("/pick", "POST", body, 400);
      }

      await writeFile(file, "{broken JSON", "utf8");
      await api("/restaurants", "GET", undefined, 500);
      await api("/restaurants", "POST", input("덮어쓰면 안 됨"), 500);
      assert.equal(
        await readFile(file, "utf8"),
        "{broken JSON",
        "A corrupt store must never be silently overwritten",
      );
    } finally {
      if (server.exitCode === null) {
        const stopped = once(server, "exit");
        server.kill();
        await stopped;
      }
      // Only the temporary directory created by this test is removed.
      assert.equal(
        path.dirname(path.resolve(directory)),
        path.resolve(tmpdir()),
      );
      assert.ok(path.basename(directory).startsWith("lunch-api-test-"));
      await rm(directory, { recursive: true, force: true });
    }
  },
);
