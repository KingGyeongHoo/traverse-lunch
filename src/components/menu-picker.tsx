"use client";

import { useState } from "react";
import { CATEGORIES, type Category } from "@/lib/lunch";
import { MENUS } from "@/lib/menus";
import SelectionIcon from "./selection-icon";

export default function MenuPicker() {
  const [category, setCategory] = useState<Category | "전체">("전체");
  const [picked, setPicked] = useState<(typeof MENUS)[number] | null>(null);
  const candidates = MENUS.filter(
    (menu) => category === "전체" || menu.category === category,
  );

  return (
    <>
      <div className="menu-filters filters" aria-label="음식 종류">
        {(["전체", ...CATEGORIES] as const).map((value) => (
          <button
            key={value}
            className={category === value ? "active" : ""}
            aria-pressed={category === value}
            onClick={() => {
              setCategory(value);
              setPicked(null);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <section className="menu-result" aria-labelledby="menu-result-title">
        <div className="menu-result-copy" aria-live="polite" aria-atomic="true">
          <h2 id="menu-result-title">{picked?.name ?? "메뉴 추첨"}</h2>
          {picked && <p>{picked.category}</p>}
        </div>
        <div className="menu-symbol">
          <SelectionIcon kind="menus" />
        </div>
        <button
          className="primary pick-button"
          onClick={() =>
            setPicked(candidates[Math.floor(Math.random() * candidates.length)])
          }
        >
          {picked ? "다시 뽑기" : "메뉴 뽑기"}
          <span aria-hidden="true">↗</span>
        </button>
      </section>
      <section className="menu-candidates" aria-labelledby="menu-list-title">
        <div className="section-heading">
          <h2 id="menu-list-title">
            오늘의 후보 <span>{candidates.length}</span>
          </h2>
        </div>
        <ul className="menu-grid">
          {candidates.map((menu) => (
            <li
              key={menu.name}
              className={picked?.name === menu.name ? "selected" : ""}
            >
              <span>{menu.category}</span>
              <strong>{menu.name}</strong>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
