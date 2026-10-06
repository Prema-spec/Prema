import test from "node:test";
import assert from "node:assert/strict";
import { getRequirementStatus, getStatusRows, validateRequirementsDocument } from "../src/lib/requirements.js";

const deadline = "2026-12-20";
const sampleRequirement = { id: "test", order: 1, title_en: "Test", title_bn: "পরীক্ষা", mandatory: true, has_expiry: false };

test("validates tender data and sorts requirements by order", () => {
  const pack = validateRequirementsDocument({
    tender: {
      tender_id: "T-1",
      title: "Example",
      procuring_entity: "Office",
      bidder: "Bidder",
      submission_deadline: deadline,
    },
    requirements: [
      { ...sampleRequirement, id: "second", order: 2 },
      { ...sampleRequirement, id: "first", order: 1 },
    ],
  });
  assert.deepEqual(pack.requirements.map(({ id }) => id), ["first", "second"]);
});

test("rejects malformed requirements documents and duplicate requirement ids", () => {
  assert.throws(() => validateRequirementsDocument({}), /tender/);
  const duplicate = {
    tender: { tender_id: "T", title: "T", procuring_entity: "P", bidder: "B", submission_deadline: deadline },
    requirements: [sampleRequirement, sampleRequirement],
  };
  assert.throws(() => validateRequirementsDocument(duplicate), /unique/);
});

test("returns all five required document statuses, including same-day expiry", () => {
  const file = { id: "file" };
  assert.equal(getRequirementStatus(sampleRequirement, undefined, "", deadline), "missing");
  assert.equal(getRequirementStatus({ ...sampleRequirement, mandatory: false }, undefined, "", deadline), "notProvided");
  assert.equal(getRequirementStatus({ ...sampleRequirement, has_expiry: true }, file, "", deadline), "expiryNeeded");
  assert.equal(getRequirementStatus({ ...sampleRequirement, has_expiry: true }, file, "2026-12-19", deadline), "expired");
  assert.equal(getRequirementStatus({ ...sampleRequirement, has_expiry: true }, file, deadline, deadline), "ok");
  assert.equal(getRequirementStatus(sampleRequirement, file, "", deadline), "ok");
});

test("reports blocking status rows separately from optional omissions", () => {
  const rows = getStatusRows(
    [sampleRequirement, { ...sampleRequirement, id: "optional", mandatory: false }],
    [],
    {},
    {},
    deadline,
  );
  assert.deepEqual(rows.map(({ status, blocksPackage }) => [status, blocksPackage]), [
    ["missing", true],
    ["notProvided", false],
  ]);
});
