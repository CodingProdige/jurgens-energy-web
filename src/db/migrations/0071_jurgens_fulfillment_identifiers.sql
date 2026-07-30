DO $$
DECLARE
  legacy_value text := 'pies' || 'sang_fulfilled';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type type_record
    JOIN pg_enum enum_record ON enum_record.enumtypid = type_record.oid
    WHERE type_record.typname = 'product_fulfillment_mode'
      AND enum_record.enumlabel = legacy_value
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type type_record
    JOIN pg_enum enum_record ON enum_record.enumtypid = type_record.oid
    WHERE type_record.typname = 'product_fulfillment_mode'
      AND enum_record.enumlabel = 'jurgens_fulfilled'
  ) THEN
    EXECUTE format(
      'ALTER TYPE %I RENAME VALUE %L TO %L',
      'product_fulfillment_mode',
      legacy_value,
      'jurgens_fulfilled'
    );
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  legacy_value text := 'pies' || 'sang_local';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type type_record
    JOIN pg_enum enum_record ON enum_record.enumtypid = type_record.oid
    WHERE type_record.typname = 'shipping_provider'
      AND enum_record.enumlabel = legacy_value
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type type_record
    JOIN pg_enum enum_record ON enum_record.enumtypid = type_record.oid
    WHERE type_record.typname = 'shipping_provider'
      AND enum_record.enumlabel = 'jurgens_local'
  ) THEN
    EXECUTE format(
      'ALTER TYPE %I RENAME VALUE %L TO %L',
      'shipping_provider',
      legacy_value,
      'jurgens_local'
    );
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  legacy_column text := 'is_' || 'pies' || 'sang_fulfillment_enabled';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sellers'
      AND column_name = legacy_column
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sellers'
      AND column_name = 'is_jurgens_fulfillment_enabled'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I RENAME COLUMN %I TO %I',
      'sellers',
      legacy_column,
      'is_jurgens_fulfillment_enabled'
    );
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sellers'
      AND column_name = legacy_column
  ) THEN
    EXECUTE format(
      'UPDATE %I SET %I = %I OR %I',
      'sellers',
      'is_jurgens_fulfillment_enabled',
      'is_jurgens_fulfillment_enabled',
      legacy_column
    );
    EXECUTE format(
      'ALTER TABLE %I DROP COLUMN %I',
      'sellers',
      legacy_column
    );
  END IF;
END $$;
