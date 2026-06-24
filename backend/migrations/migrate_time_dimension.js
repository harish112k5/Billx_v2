/**
 * migrate_time_dimension.js
 * One-shot migration script to add Time Dimension tables and populate schedules.
 * 
 * Run: node migrations/migrate_time_dimension.js
 * 
 * Idempotent — safe to re-run (uses INSERT IGNORE, IF NOT EXISTS).
 */

const db = require('../db');
const { v4: uuidv4 } = require('uuid');

async function migrateTimeDimension() {
  console.log('🕐 Starting Time Dimension migration...\n');

  // ── Step 1: ALTER boq_items — add schedule columns ──────────
  console.log('1️⃣  Adding schedule columns to boq_items...');
  try {
    await db.query(`
      ALTER TABLE boq_items 
      ADD COLUMN planned_start_date DATE NULL,
      ADD COLUMN planned_end_date DATE NULL,
      ADD COLUMN planned_duration_days INT NULL
    `);
    console.log('   ✅ Columns added.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('   ⏩ Columns already exist — skipping.');
    } else {
      throw e;
    }
  }

  // ── Step 2: Create boq_item_schedules table ─────────────────
  console.log('2️⃣  Creating boq_item_schedules table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS boq_item_schedules (
      schedule_id CHAR(36) PRIMARY KEY,
      boq_id CHAR(36) NOT NULL,
      project_id CHAR(36) NOT NULL,
      period_type ENUM('weekly', 'monthly', 'milestone') DEFAULT 'monthly',
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      planned_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
      planned_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      actual_quantity DECIMAL(15,4) DEFAULT 0,
      actual_amount DECIMAL(18,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_boq_period (boq_id, period_start),
      FOREIGN KEY (boq_id) REFERENCES boq_items(boq_id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('   ✅ boq_item_schedules table ready.');

  // Create indexes (ignore if exist)
  try {
    await db.query(`CREATE INDEX idx_sched_project ON boq_item_schedules(project_id)`);
  } catch (e) { /* index may exist */ }
  try {
    await db.query(`CREATE INDEX idx_sched_period ON boq_item_schedules(period_start, period_end)`);
  } catch (e) { /* index may exist */ }
  try {
    await db.query(`CREATE INDEX idx_sched_boq ON boq_item_schedules(boq_id)`);
  } catch (e) { /* index may exist */ }
  try {
    await db.query(`CREATE INDEX idx_boq_time ON boq_items(project_id, planned_start_date, planned_end_date)`);
  } catch (e) { /* index may exist */ }

  // ── Step 3: Create project_milestones table ─────────────────
  console.log('3️⃣  Creating project_milestones table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_milestones (
      milestone_id CHAR(36) PRIMARY KEY,
      project_id CHAR(36) NOT NULL,
      milestone_name VARCHAR(200) NOT NULL,
      milestone_date DATE NOT NULL,
      description TEXT,
      status ENUM('planned', 'achieved', 'delayed') DEFAULT 'planned',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('   ✅ project_milestones table ready.');

  // ── Step 4: Populate boq_items dates from project dates ─────
  console.log('4️⃣  Setting BOQ item dates from project dates...');
  const [updated] = await db.query(`
    UPDATE boq_items bi
    JOIN projects p ON bi.project_id = p.project_id
    SET bi.planned_start_date = p.start_date,
        bi.planned_end_date = p.end_date,
        bi.planned_duration_days = DATEDIFF(p.end_date, p.start_date)
    WHERE bi.planned_start_date IS NULL
      AND p.start_date IS NOT NULL
      AND p.end_date IS NOT NULL
  `);
  console.log(`   ✅ Updated ${updated.affectedRows || 0} BOQ items.`);

  // ── Step 5: Generate monthly schedules for existing items ───
  console.log('5️⃣  Generating monthly schedules for existing BOQ items...');

  const [projects] = await db.query(`SELECT project_id, start_date, end_date FROM projects WHERE start_date IS NOT NULL AND end_date IS NOT NULL`);
  let totalGenerated = 0;

  for (const project of projects) {
    const [boqItems] = await db.query(
      `SELECT boq_id, planned_quantity, unit_rate, planned_start_date, planned_end_date 
       FROM boq_items WHERE project_id = ?`,
      [project.project_id]
    );

    for (const item of boqItems) {
      const startDate = item.planned_start_date || project.start_date;
      const endDate = item.planned_end_date || project.end_date;
      if (!startDate || !endDate) continue;

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) continue;

      const totalMonths = Math.max(1,
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth()) + 1
      );

      const plannedQty = parseFloat(item.planned_quantity) || 0;
      const unitRate = parseFloat(item.unit_rate) || 0;
      const monthlyQty = parseFloat((plannedQty / totalMonths).toFixed(4));
      const monthlyAmt = parseFloat((monthlyQty * unitRate).toFixed(2));

      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

      while (current <= endMonth) {
        const periodStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

        try {
          await db.query(
            `INSERT IGNORE INTO boq_item_schedules 
             (schedule_id, boq_id, project_id, period_start, period_end, planned_quantity, planned_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), item.boq_id, project.project_id,
             periodStart.toISOString().split('T')[0],
             periodEnd.toISOString().split('T')[0],
             monthlyQty, monthlyAmt]
          );
          totalGenerated++;
        } catch (e) {
          // Skip duplicates
        }

        current.setMonth(current.getMonth() + 1);
      }
    }
  }

  console.log(`   ✅ Generated ${totalGenerated} schedule entries across ${projects.length} projects.`);
  console.log('\n🎉 Time Dimension migration complete!');
  process.exit(0);
}

migrateTimeDimension().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
