DO $$
DECLARE
  has_any_legacy_account_column boolean;
  has_legacy_account_columns boolean;
  has_unmapped_legacy_accounts boolean;
BEGIN
  SELECT
    EXISTS (
      SELECT 1
      FROM "information_schema"."columns"
      WHERE
        "table_schema" = current_schema()
        AND "table_name" = 'marketplace_settings'
        AND "column_name" = 'courier_guy_live_account_id'
    )
    AND EXISTS (
      SELECT 1
      FROM "information_schema"."columns"
      WHERE
        "table_schema" = current_schema()
        AND "table_name" = 'marketplace_settings'
        AND "column_name" = 'courier_guy_sandbox_account_id'
    )
    AND EXISTS (
      SELECT 1
      FROM "information_schema"."columns"
      WHERE
        "table_schema" = current_schema()
        AND "table_name" = 'shipments'
        AND "column_name" = 'provider_account_id'
    )
  INTO has_legacy_account_columns;

  SELECT EXISTS (
    SELECT 1
    FROM "information_schema"."columns"
    WHERE
      "table_schema" = current_schema()
      AND (
        (
          "table_name" = 'marketplace_settings'
          AND "column_name" IN (
            'courier_guy_live_account_id',
            'courier_guy_sandbox_account_id'
          )
        )
        OR (
          "table_name" = 'shipments'
          AND "column_name" = 'provider_account_id'
        )
      )
  )
  INTO has_any_legacy_account_column;

  IF has_any_legacy_account_column AND NOT has_legacy_account_columns THEN
    RAISE EXCEPTION
      'Courier Guy migration stopped: the legacy numeric account-ID schema is incomplete. Restore or map the missing legacy columns before rerunning migration 0077.';
  END IF;

  IF has_legacy_account_columns THEN
    EXECUTE $sql$
      UPDATE "shipments" AS "shipment"
      SET "provider_account_code" = CASE
        WHEN
          "shipment"."provider_environment" = 'live'
          AND "shipment"."provider_account_id" =
            "settings"."courier_guy_live_account_id"
          THEN NULLIF(btrim("settings"."courier_guy_live_account_code"), '')
        WHEN
          "shipment"."provider_environment" = 'sandbox'
          AND "shipment"."provider_account_id" =
            "settings"."courier_guy_sandbox_account_id"
          THEN NULLIF(
            btrim("settings"."courier_guy_sandbox_account_code"),
            ''
          )
        ELSE NULL
      END
      FROM "marketplace_settings" AS "settings"
      WHERE
        "settings"."id" = 1
        AND "shipment"."provider" = 'courier_guy'
        AND NULLIF(btrim("shipment"."provider_account_code"), '') IS NULL
        AND "shipment"."provider_account_id" IS NOT NULL
    $sql$;

    EXECUTE $sql$
      SELECT
        EXISTS (
          SELECT 1
          FROM "marketplace_settings"
          WHERE
            (
              "courier_guy_live_account_id" IS NOT NULL
              AND NULLIF(
                btrim("courier_guy_live_account_code"),
                ''
              ) IS NULL
            )
            OR (
              "courier_guy_sandbox_account_id" IS NOT NULL
              AND NULLIF(
                btrim("courier_guy_sandbox_account_code"),
                ''
              ) IS NULL
            )
        )
        OR EXISTS (
          SELECT 1
          FROM "shipments"
          WHERE
            "provider_account_id" IS NOT NULL
            AND NULLIF(btrim("provider_account_code"), '') IS NULL
        )
    $sql$
    INTO has_unmapped_legacy_accounts;

    IF has_unmapped_legacy_accounts THEN
      RAISE EXCEPTION
        'Courier Guy migration stopped: legacy numeric account IDs cannot be inferred as account codes. Populate the matching account-code columns, then rerun migration 0077.';
    END IF;
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "shipments"
  DROP CONSTRAINT IF EXISTS "shipments_courier_guy_account_positive",
  DROP CONSTRAINT IF EXISTS "shipments_courier_guy_identity_scoped";
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP CONSTRAINT IF EXISTS "marketplace_settings_courier_guy_live_account_id_positive",
  DROP CONSTRAINT IF EXISTS "marketplace_settings_courier_guy_sandbox_account_id_positive";
--> statement-breakpoint
ALTER TABLE "shipments"
  DROP COLUMN IF EXISTS "provider_account_id";
--> statement-breakpoint
ALTER TABLE "marketplace_settings"
  DROP COLUMN IF EXISTS "courier_guy_live_account_id",
  DROP COLUMN IF EXISTS "courier_guy_sandbox_account_id";
--> statement-breakpoint
ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_courier_guy_identity_scoped"
    CHECK (
      "provider" <> 'courier_guy'
      OR (
        (
          "provider_shipment_id" IS NULL
          AND "tracking_number" IS NULL
        )
        OR (
          "provider_environment" IS NOT NULL
          AND "provider_account_code" IS NOT NULL
        )
      )
    );
