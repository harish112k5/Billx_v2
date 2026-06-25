/**
 * db_migrate_v2.js
 * 
 * Idempotent migration: adds budget/profit columns to projects,
 * expense_type + boq_id to project_expenses,
 * actual_cost + actual_quantity to boq_items.
 * 
 * Safe to run multiple times — checks INFORMATION_SCHEMA before ALTER.
 */

const db = require('./db');

async function columnExists(table, column) {
  const [rows] = await db.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runMigrations() {
  console.log('🔄 Running V2 migrations...');

  try {
    // ── 1. Projects table: planned_budget, planned_profit, project_manager ──
    if (!(await columnExists('projects', 'planned_budget'))) {
      await db.execute('ALTER TABLE projects ADD COLUMN planned_budget DECIMAL(18,2) DEFAULT 0 AFTER contract_value');
      console.log('  ✅ Added projects.planned_budget');
    }
    if (!(await columnExists('projects', 'planned_profit'))) {
      await db.execute('ALTER TABLE projects ADD COLUMN planned_profit DECIMAL(18,2) DEFAULT 0 AFTER planned_budget');
      console.log('  ✅ Added projects.planned_profit');
    }
    if (!(await columnExists('projects', 'project_manager'))) {
      await db.execute('ALTER TABLE projects ADD COLUMN project_manager VARCHAR(200) NULL AFTER planned_profit');
      console.log('  ✅ Added projects.project_manager');
    }

    // ── 2. Project Expenses: expense_type ENUM, boq_id FK, quantity ──
    if (!(await columnExists('project_expenses', 'expense_type'))) {
      await db.execute(
        `ALTER TABLE project_expenses ADD COLUMN expense_type ENUM('material','manpower','machinery','movement','misc') DEFAULT 'material' AFTER category`
      );
      console.log('  ✅ Added project_expenses.expense_type');

      // Map existing category values to new expense_type
      await db.execute(`UPDATE project_expenses SET expense_type = 'material' WHERE category IN ('material')`);
      await db.execute(`UPDATE project_expenses SET expense_type = 'manpower' WHERE category IN ('labour', 'labor')`);
      await db.execute(`UPDATE project_expenses SET expense_type = 'machinery' WHERE category IN ('equipment')`);
      await db.execute(`UPDATE project_expenses SET expense_type = 'movement' WHERE category IN ('transport')`);
      await db.execute(`UPDATE project_expenses SET expense_type = 'misc' WHERE category IN ('overhead', 'other')`);
      console.log('  ✅ Migrated existing categories to expense_type');
    }
    if (!(await columnExists('project_expenses', 'boq_id'))) {
      await db.execute('ALTER TABLE project_expenses ADD COLUMN boq_id CHAR(36) NULL AFTER project_id');
      // Add FK only if it doesn't exist (safe)
      try {
        await db.execute(
          'ALTER TABLE project_expenses ADD CONSTRAINT fk_expense_boq FOREIGN KEY (boq_id) REFERENCES boq_items(boq_id) ON DELETE SET NULL'
        );
      } catch (fkErr) {
        // FK may already exist, ignore
        if (!fkErr.message.includes('Duplicate')) {
          console.log('  ⚠️  FK fk_expense_boq:', fkErr.message);
        }
      }
      console.log('  ✅ Added project_expenses.boq_id');
    }
    if (!(await columnExists('project_expenses', 'quantity'))) {
      await db.execute('ALTER TABLE project_expenses ADD COLUMN quantity DECIMAL(18,3) NULL AFTER amount');
      console.log('  ✅ Added project_expenses.quantity');
    }

    // ── 3. BOQ Items: actual_cost, actual_quantity ──
    if (!(await columnExists('boq_items', 'actual_cost'))) {
      await db.execute('ALTER TABLE boq_items ADD COLUMN actual_cost DECIMAL(18,2) DEFAULT 0 AFTER planned_amount');
      console.log('  ✅ Added boq_items.actual_cost');
    }
    if (!(await columnExists('boq_items', 'actual_quantity'))) {
      await db.execute('ALTER TABLE boq_items ADD COLUMN actual_quantity DECIMAL(18,3) DEFAULT 0 AFTER actual_cost');
      console.log('  ✅ Added boq_items.actual_quantity');
    }

    // ── 4. Data Events table for frequency tracking ──
    await db.execute(`
      CREATE TABLE IF NOT EXISTS data_events (
        event_id        CHAR(36) PRIMARY KEY,
        project_id      CHAR(36) NOT NULL,
        event_type      VARCHAR(50) NOT NULL,
        event_source    VARCHAR(100),
        description     TEXT,
        affected_module VARCHAR(50) NOT NULL,
        ra_bill_number  INT DEFAULT NULL,
        boq_item_code   VARCHAR(50) DEFAULT NULL,
        amount_before   DECIMAL(18,2) DEFAULT NULL,
        amount_after    DECIMAL(18,2) DEFAULT NULL,
        quantity_before DECIMAL(15,4) DEFAULT NULL,
        quantity_after  DECIMAL(15,4) DEFAULT NULL,
        file_name       VARCHAR(300) DEFAULT NULL,
        performed_by    CHAR(36),
        performed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_de_project (project_id),
        INDEX idx_de_performed_at (performed_at),
        INDEX idx_de_module (affected_module),
        INDEX idx_de_event_type (event_type)
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ data_events table OK');

    // ── 5. Projects: data frequency tracking columns ──
    if (!(await columnExists('projects', 'last_data_event_at'))) {
      await db.execute('ALTER TABLE projects ADD COLUMN last_data_event_at DATETIME DEFAULT NULL');
      console.log('  ✅ Added projects.last_data_event_at');
    }
    if (!(await columnExists('projects', 'last_data_event_type'))) {
      await db.execute('ALTER TABLE projects ADD COLUMN last_data_event_type VARCHAR(100) DEFAULT NULL');
      console.log('  ✅ Added projects.last_data_event_type');
    }
    if (!(await columnExists('projects', 'data_event_count'))) {
      await db.execute('ALTER TABLE projects ADD COLUMN data_event_count INT DEFAULT 0');
      console.log('  ✅ Added projects.data_event_count');
    }

    console.log('✅ V2 migrations complete.');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    // Don't crash — let server continue
  }
}

module.exports = runMigrations;
