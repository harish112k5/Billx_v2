const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

async function setupBudgetSchema() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billx_v2',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  console.log('Connected. Running Budget schema setup...\n');

  // 1. project_budgets
  await c.query(`
    CREATE TABLE IF NOT EXISTS project_budgets (
      budget_id         CHAR(36)      NOT NULL PRIMARY KEY,
      project_id        CHAR(36)      NOT NULL,
      department        VARCHAR(255),
      supervisor_name   VARCHAR(255),
      currency          VARCHAR(10)   DEFAULT 'INR',
      status            ENUM('draft','approved','revised') DEFAULT 'draft',
      notes             TEXT,
      created_by        CHAR(36),
      created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_budget_project FOREIGN KEY (project_id) REFERENCES projects(project_id),
      CONSTRAINT fk_budget_creator FOREIGN KEY (created_by) REFERENCES users(user_id),
      CONSTRAINT uq_budget_project UNIQUE (project_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ project_budgets table created');

  // 2. budget_items
  await c.query(`
    CREATE TABLE IF NOT EXISTS budget_items (
      budget_item_id          CHAR(36)      NOT NULL PRIMARY KEY,
      budget_id               CHAR(36)      NOT NULL,
      wbs_code                VARCHAR(20),
      task_name               VARCHAR(500)  NOT NULL,
      assigned_to             VARCHAR(255),
      category                VARCHAR(50),

      planned_hours           DECIMAL(15,2) DEFAULT 0,
      actual_hours            DECIMAL(15,2) DEFAULT 0,
      labor_rate              DECIMAL(15,2) DEFAULT 0,

      planned_material_units  DECIMAL(15,3) DEFAULT 0,
      actual_material_units   DECIMAL(15,3) DEFAULT 0,
      material_rate           DECIMAL(15,2) DEFAULT 0,

      travel_cost             DECIMAL(15,2) DEFAULT 0,
      equipment_cost          DECIMAL(15,2) DEFAULT 0,
      fixed_cost              DECIMAL(15,2) DEFAULT 0,
      misc_cost               DECIMAL(15,2) DEFAULT 0,

      budgeted_amount         DECIMAL(15,2) DEFAULT 0,
      actual_amount           DECIMAL(15,2) DEFAULT 0,
      variance_amount         DECIMAL(15,2) DEFAULT 0,

      display_order           INT           DEFAULT 0,
      created_at              DATETIME      DEFAULT CURRENT_TIMESTAMP,
      updated_at              DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_budgetitem_budget FOREIGN KEY (budget_id) REFERENCES project_budgets(budget_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ budget_items table created');

  // 3. Alter excel_imports enum to add 'budget'
  try {
    await c.query(`
      ALTER TABLE excel_imports
        MODIFY COLUMN import_type ENUM('budget','boq','ra_bill') NOT NULL
    `);
    console.log('✅ excel_imports.import_type updated to include budget');
  } catch (e) {
    if (e.message.includes('Duplicate')) {
      console.log('ℹ️  excel_imports.import_type already includes budget');
    } else {
      console.log('⚠️  excel_imports alter:', e.message);
    }
  }

  // 4. v_budget_vs_actual view
  await c.query(`
    CREATE OR REPLACE VIEW v_budget_vs_actual AS
    SELECT
      pb.project_id,
      pb.budget_id,
      bi.category,
      SUM(bi.budgeted_amount)   AS total_budgeted,
      SUM(bi.actual_amount)     AS total_actual,
      SUM(bi.variance_amount)   AS total_variance,
      COALESCE(pe.spent, 0)     AS total_expenses_recorded
    FROM project_budgets pb
    JOIN budget_items bi ON bi.budget_id = pb.budget_id
    LEFT JOIN (
      SELECT project_id, category, SUM(amount) AS spent
      FROM project_expenses
      GROUP BY project_id, category
    ) pe ON pe.project_id = pb.project_id AND pe.category = bi.category
    GROUP BY pb.project_id, pb.budget_id, bi.category, pe.spent
  `);
  console.log('✅ v_budget_vs_actual view created');

  console.log('\n✅ Budget schema setup complete!');
  await c.end();
}

setupBudgetSchema().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
