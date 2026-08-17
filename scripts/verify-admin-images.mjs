#!/usr/bin/env node
/**
 * Targeted tests for the admin gallery image-list helpers
 * (src/modules/admin/image-list.ts) that back the master-user gallery editor:
 * add (append/dedupe/cap), remove, and reorder (lenient keep-existing filter).
 *
 * Usage: node scripts/verify-admin-images.mjs
 * Exits 1 on any failure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_MAX_IMAGES,
  addImageUrls,
  removeImageUrl,
  reorderImageUrls,
} from "../src/modules/admin/image-list.ts";

const URLS = {
  a: "https://img.example.com/a.jpg",
  b: "https://img.example.com/b.jpg",
  c: "https://img.example.com/c.jpg",
  foreign: "https://evil.example.com/x.jpg",
};

test("addImageUrls appends new URLs in order", () => {
  assert.deepEqual(addImageUrls([URLS.a], [URLS.b, URLS.c]), [URLS.a, URLS.b, URLS.c]);
});

test("addImageUrls skips URLs already present (no duplicates)", () => {
  assert.deepEqual(addImageUrls([URLS.a, URLS.b], [URLS.b, URLS.c]), [URLS.a, URLS.b, URLS.c]);
});

test("addImageUrls never exceeds ADMIN_MAX_IMAGES and truncates the tail", () => {
  const full = Array.from({ length: ADMIN_MAX_IMAGES }, (_, i) => `${URLS.a}?i=${i}`);
  const next = addImageUrls(full, [URLS.b, URLS.c]);
  assert.equal(next.length, ADMIN_MAX_IMAGES);
  assert.equal(next.at(-1), full.at(-1));
});

test("removeImageUrl removes every occurrence and leaves others untouched", () => {
  assert.deepEqual(removeImageUrl([URLS.a, URLS.b, URLS.a], URLS.a), [URLS.b]);
});

test("removeImageUrl is a no-op when the URL is absent", () => {
  assert.deepEqual(removeImageUrl([URLS.a, URLS.b], URLS.c), [URLS.a, URLS.b]);
});

test("reorderImageUrls applies the requested order", () => {
  const out = reorderImageUrls([URLS.a, URLS.b, URLS.c], [URLS.c, URLS.a, URLS.b]);
  assert.deepEqual(out, [URLS.c, URLS.a, URLS.b]);
});

test("reorderImageUrls drops unknown URLs (lenient keep-existing filter)", () => {
  const out = reorderImageUrls([URLS.a, URLS.b], [URLS.foreign, URLS.a, URLS.b]);
  assert.deepEqual(out, [URLS.a, URLS.b]);
  assert.ok(!out.includes(URLS.foreign));
});

test("reorderImageUrls returns empty when nothing exists", () => {
  assert.deepEqual(reorderImageUrls([], [URLS.a]), []);
});
