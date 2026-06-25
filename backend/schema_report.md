| Object Name | Type | Exists Locally? | Exists on Aiven? | Structure Matches? | Differences Found |
|---|---|---|---|---|---|
| boq_allocations | TABLE | Yes | Yes | Yes | None |
| boq_items | TABLE | Yes | Yes | No | Col item_number type: int(11) vs int |
| budget_items | TABLE | Yes | Yes | No | Col display_order type: int(11) vs int |
| excel_imports | TABLE | Yes | Yes | No | Col ra_number_detected type: int(11) vs int; Col total_sheets type: int(11) vs int; Col boq_items_found type: int(11) vs int; Col measurements_found type: int(11) vs int; Col errors_count type: int(11) vs int |
| investments | TABLE | Yes | Yes | Yes | None |
| investors | TABLE | Yes | Yes | Yes | None |
| measurements | TABLE | Yes | Yes | No | Col serial_no type: int(11) vs int; Col ipc_number type: int(11) vs int |
| organizations | TABLE | Yes | Yes | Yes | None |
| project_budgets | TABLE | Yes | Yes | Yes | None |
| project_contracts | TABLE | Yes | Yes | Yes | None |
| project_expenses | TABLE | Yes | Yes | Yes | None |
| projects | TABLE | Yes | Yes | Yes | None |
| ra_bill_items | TABLE | Yes | Yes | Yes | None |
| ra_bills | TABLE | Yes | Yes | No | Col ra_number type: int(11) vs int; Col ipc_number type: int(11) vs int |
| users | TABLE | Yes | Yes | Yes | None |
| v_boq_progress | VIEW | Yes | Yes | No | Col item_number type: int(11) vs int |
| v_budget_vs_actual | VIEW | Yes | Yes | Yes | None |
| v_project_financial_summary | VIEW | Yes | Yes | No | Col total_ra_bills type: bigint(21) vs bigint |
| v_ra_bill_summary | VIEW | Yes | Yes | No | Col ra_number type: int(11) vs int |