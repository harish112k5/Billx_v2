/**
 * eventLogger.js
 * 
 * Centralized data event logger for frequency tracking.
 * Records every data change (import, manual entry, payment, stage change)
 * so charts can show "last updated" timestamps.
 * 
 * IMPORTANT: This function NEVER throws — it catches all errors internally
 * so that event logging never breaks the main operation.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Log a data event for a project.
 * 
 * @param {object} dbConn - mysql2 promise pool or connection
 * @param {string} project_id
 * @param {string} event_type - e.g. 'excel_import', 'manual_boq_entry', 'manual_ra_bill', etc.
 * @param {string} affected_module - e.g. 'boq', 'ra_bill', 'measurements', 'expenses', 'payments', 'analytics'
 * @param {object} options
 * @param {string} [options.description]
 * @param {number} [options.ra_bill_number]
 * @param {string} [options.boq_item_code]
 * @param {number} [options.amount_before]
 * @param {number} [options.amount_after]
 * @param {number} [options.quantity_before]
 * @param {number} [options.quantity_after]
 * @param {string} [options.file_name]
 * @param {string} [options.performed_by] - user_id
 * @param {string} [options.event_source] - e.g. 'web_app', 'api'
 * @returns {string|null} event_id on success, null on failure
 */
async function logDataEvent(dbConn, project_id, event_type, affected_module, options = {}) {
  try {
    const event_id = uuidv4();
    const {
      description = null,
      ra_bill_number = null,
      boq_item_code = null,
      amount_before = null,
      amount_after = null,
      quantity_before = null,
      quantity_after = null,
      file_name = null,
      performed_by = null,
      event_source = 'web_app',
    } = options;

    // 1. Insert into data_events
    await dbConn.execute(
      `INSERT INTO data_events
       (event_id, project_id, event_type, event_source, description, affected_module,
        ra_bill_number, boq_item_code, amount_before, amount_after,
        quantity_before, quantity_after, file_name, performed_by, performed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        event_id, project_id, event_type, event_source, description, affected_module,
        ra_bill_number, boq_item_code, amount_before, amount_after,
        quantity_before, quantity_after, file_name, performed_by
      ]
    );

    // 2. Update project's last event info
    await dbConn.execute(
      `UPDATE projects 
       SET last_data_event_at = NOW(),
           last_data_event_type = ?,
           data_event_count = COALESCE(data_event_count, 0) + 1
       WHERE project_id = ?`,
      [event_type, project_id]
    );

    return event_id;
  } catch (err) {
    // NEVER throw — event logging must not break the main operation
    console.error('[EventLogger] Failed to log data event:', err.message);
    return null;
  }
}

module.exports = { logDataEvent };
