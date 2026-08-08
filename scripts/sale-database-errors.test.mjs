import assert from "node:assert/strict";
import test from "node:test";

import {
  getFriendlySalesErrorMessage,
  isMissingSalesSchemaError,
} from "../src/modules/sales/database-errors.ts";

test("recognizes missing sales tables through nested database errors", () => {
  const error = new Error("Failed query: select from sale_campaigns", {
    cause: Object.assign(new Error('relation "sale_campaigns" does not exist'), {
      code: "42P01",
    }),
  });

  assert.equal(isMissingSalesSchemaError(error), true);
  assert.match(
    getFriendlySalesErrorMessage("read", error),
    /Run "npm run db:migrate" and redeploy/,
  );
});

test("does not classify unrelated database failures as missing sales schema", () => {
  const error = Object.assign(new Error("connection timed out"), {
    code: "57014",
  });

  assert.equal(isMissingSalesSchemaError(error), false);
  assert.match(
    getFriendlySalesErrorMessage("create", error),
    /Could not create sale campaign/,
  );
});

test("explains active-sale uniqueness conflicts", () => {
  const error = Object.assign(new Error("duplicate key value"), {
    code: "23505",
  });

  assert.equal(
    getFriendlySalesErrorMessage("create", error),
    "Some selected variants are already on an active sale campaign.",
  );
});
