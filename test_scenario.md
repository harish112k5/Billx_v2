# BillX V2 — End-to-End Manual Test Scenario

This document contains a complete, interlinked set of data for a fictional project ("Highway Alpha Phase 1"). The data is mathematically consistent, allowing you to enter it step-by-step and verify that the application's calculations, budget warnings, and analytics are perfectly accurate.

---

## 1. Create Project (Financial Planning)
First, create the project. This sets the baseline for the budget formula: `Planned Budget = Contract Value - Planned Profit`.

*   **Project Code**: `HWY-A-001`
*   **Project Name**: Highway Alpha Phase 1
*   **Contract Value**: `1,000,000` (10 Lakhs)
*   **Expected Profit**: `200,000` (2 Lakhs)
*   **Planned Budget (Auto-calculated)**: Should show `800,000` (8 Lakhs)
*   **Status**: Ongoing

---

## 2. Enter Bill of Quantities (BOQ)
The BOQ defines the scope of work and the revenue you expect to generate. The total planned amount here should match your Contract Value.

| Item Code | Description | Unit | Planned Qty | Unit Rate (₹) | Planned Amount (₹) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EW-01** | Earthwork Excavation | Cum | 10,000 | 20 | 200,000 |
| **CC-01** | Concrete M30 Grade | Cum | 1,000 | 5,00 | 500,000 |
| **BT-01** | Asphalt / Bitumen Top | Sqm | 5,000 | 60 | 300,000 |

*   *Total BOQ Value:* `1,000,000`

---

## 3. Enter Budget Items
This defines your planned costs to execute the BOQ. The total budget here should match your project's Planned Budget (800,000).

| Category / Task | Linked to BOQ? | Budgeted Amount (₹) | Note |
| :--- | :--- | :--- | :--- |
| **Earthwork Costs** | EW-01 | 150,000 | (Targeting 50k profit on EW) |
| **Concrete Costs** | CC-01 | 420,000 | (Targeting 80k profit on CC) |
| **Asphalt Costs** | BT-01 | 230,000 | (Targeting 70k profit on BT) |

*   *Total Budgeted Amount:* `800,000`

---

## 4. Enter Expenses (Actual Costs incurred so far)
Let's simulate the project being halfway done. We will incur expenses and link them to BOQ items and Expense Types.

| Date | Expense Type | Category | Description | Amount (₹) | Linked BOQ | Vendor |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Day 1 | Machinery | Excavator | JCB Rental for week 1 | 40,000 | EW-01 | Alpha Rentals |
| Day 2 | Movement | Diesel | Fuel for JCB | 10,000 | EW-01 | Shell Pump |
| Day 3 | Material | Cement | 1000 bags cement | 150,000 | CC-01 | UltraTech |
| Day 4 | Material | Steel | 5 tons rebar | 60,000 | CC-01 | Tata Steel |
| Day 5 | Manpower | Labor | Week 1 wages | 40,000 | CC-01 | XYZ Contractors |
| Day 6 | Misc | Office | Site office setup | 20,000 | (Leave Blank) | Local Store |

*   *Total Expenses:* `320,000`
    *   *Total Cost for EW-01:* 50,000
    *   *Total Cost for CC-01:* 250,000

---

## 5. Enter Measurements & RA Bill 1 (Execution & Revenue)
Now we bill the client for the work executed so far.

**Step A: Measurements (Execution)**
*   Add Measurement for **EW-01**: Executed Qty = `4,000` Cum
*   Add Measurement for **CC-01**: Executed Qty = `600` Cum
*   Add Measurement for **BT-01**: Executed Qty = `0` (Not started)

**Step B: Generate RA Bill 1**
Based on measurements, the system should calculate:
*   EW-01: 4,000 * 20 = `80,000`
*   CC-01: 600 * 500 = `300,000`
*   **Total RA 1 Basic Amount**: `380,000`

**Step C: Record Payment Received**
*   Record that against RA Bill 1, the client paid you: `350,000` (Assuming 30k held as retention/taxes).

---

## 6. Verification Checklist (What to check in the UI)

After entering all the above data, check the application dashboards to verify mathematical accuracy:

### A. Dashboard & Project Overview
*   **Budget Used %**: `40%` (Expenses: 320,000 / Budget: 800,000). Status should be **Green** (Safe < 70%).
*   **Budget Remaining**: `480,000`
*   **Current Profit**: `30,000` (Received: 350,000 - Expenses: 320,000). Status should be **Red/Below Target** (since 30k < 200k planned profit).

### B. Analytics Page
*   **Planned vs Executed (Variance)**:
    *   Total Planned BOQ: `1,000,000`
    *   Total Executed BOQ: `380,000`
*   **Expense Breakdown Pie Chart**:
    *   Material: 210,000
    *   Machinery: 40,000
    *   Manpower: 40,000
    *   Misc: 20,000
    *   Movement: 10,000
*   **Budget Overrun Alerts**: You should see **NO alerts** because actual costs are well below planned budgets for each item.

### C. BOQ Page (Cost Per Unit Analysis)
Click on **CC-01 (Concrete)** in the BOQ table to open the modal:
*   **Budget vs Actual Chart**:
    *   Planned Budget: `500,000`
    *   Actual Cost: `250,000` (Green bar)
    *   Executed Value: `300,000`
*   **Cost Per Unit Analysis**:
    *   Planned Rate: `500` / Cum
    *   Actual Rate: `416.67` / Cum (Actual Cost: 250,000 / Executed Qty: 600)
    *   Variance: `+83.33` / Cum (Green / Favorable variance)

### D. Testing Budget Overrun (The Warning System)
To test the warning system:
1. Go to Expenses and add a new expense.
2. Link it to **EW-01 (Earthwork)**.
3. Make the amount `160,000`.
4. *Expected Result:* The system should show a yellow warning banner stating that this expense will push EW-01 over its planned budget of 200,000 (Current 50k + New 160k = 210k).
5. Save it anyway.
6. Go to the **Analytics Page**. You should now see a red **Budget Overrun Alert** for EW-01 (Overrun by 10,000).
