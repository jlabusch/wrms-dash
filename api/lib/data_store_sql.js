var util = require('wrms-dash-util');

module.exports = {
    delete_all: [
        'DELETE FROM contracts',
        'DELETE FROM systems',
        'DELETE FROM budgets',
        'DELETE FROM wrs',
        'DELETE FROM timesheets',
        'DELETE FROM quotes'
    ],
    create_schema: [
        `CREATE TABLE contracts (
            id TEXT PRIMARY KEY,
            org_id INTEGER NOT NULL,
            org_name TEXT NOT NULL,
            cash_value REAL NOT NULL,
            cash_rate REAL NOT NULL,
            cash_currency TEXT NOT NULL DEFAULT "GBP",
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL
        )`,
        `CREATE TABLE systems (
            id INTEGER PRIMARY KEY,
            name TEXT
        )`,
        `CREATE TABLE contract_system_link (
            contract_id REFERENCES contracts(id) ON DELETE CASCADE,
            system_id REFERENCES systems(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE budgets (
            id TEXT PRIMARY KEY,
            base_hours REAL NOT NULL,
            base_hours_spent REAL NOT NULL,
            sla_quote_hours REAL NOT NULL,
            additional_hours REAL NOT NULL
        )`,
        `CREATE TABLE contract_budget_link (
            contract_id REFERENCES contracts(id) ON DELETE CASCADE,
            budget_id REFERENCES budgets(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE wrs (
            id INTEGER PRIMARY KEY,
            system_id REFERENCES systems(id) ON DELETE CASCADE,
            created_on TEXT NOT NULL,
            brief TEXT NOT NULL,
            detailed TEXT NOT NULL,
            status TEXT NOT NULL,
            urgency TEXT NOT NULL,
            importance TEXT NOT NULL,
            hours REAL NOT NULL,
            tag_unchargeable INTEGER,
            tag_additional INTEGER,
            tags TEXT,
            invoice_to TEXT
        )`,
        `CREATE TABLE timesheets (
            id INTEGER PRIMARY KEY,
            wr_id REFERENCES wrs(id) ON DELETE CASCADE,
            budget_id REFERENCES budgets(id) ON DELETE CASCADE,
            worked_on TEXT NOT NULL,
            hours REAL NOT NULL
        )`,
        `CREATE TABLE quotes (
            id INTEGER PRIMARY KEY,
            budget_id REFERENCES budgets(id) ON DELETE CASCADE,
            wr_id REFERENCES wrs(id) ON DELETE CASCADE,
            approved_on TEXT NOT NULL,
            hours REAL NOT NULL,
            additional INTEGER NOT NULL,
            valid INTEGER NOT NULL,
            approved INTEGER NOT NULL
        )`
    ],
    dump: {
        contracts:  util.trim `
                    SELECT  c.id as contract_id,c.org_id,c.start_date,c.end_date,
                            cs.system_id,c.cash_value,c.cash_rate,c.cash_currency
                    FROM contracts c
                    LEFT JOIN contract_system_link cs ON cs.contract_id=c.id
                    `,
        budgets:  util.trim `
                    SELECT  c.id as contract_id,
                            b.id as budget_id,b.base_hours,b.base_hours_spent,b.sla_quote_hours,b.additional_hours
                    FROM contracts c
                    LEFT JOIN contract_budget_link cb ON cb.contract_id=c.id
                    LEFT JOIN budgets b ON b.id=cb.budget_id
                    `,
        wrs:        util.trim `
                    SELECT w.id as wr_id,w.created_on,w.status,w.hours as wr_hours,w.tags,
                            q.id as quote_id,q.hours as quote_hours,q.additional as quote_additional,q.approved as quote_approved, q.valid as quote_valid,
                            q.budget_id, q.approved_on AS quote_approved_on
                    FROM wrs w
                    LEFT JOIN quotes q ON q.wr_id=w.id
                    `,
        timesheets: util.trim `
                    SELECT t.wr_id, w.brief, t.budget_id, t.hours
                    FROM timesheets t
                    JOIN wrs w ON w.id=t.wr_id
                    ORDER BY t.wr_id
                    `
    },
    add_contract: 'INSERT OR REPLACE INTO contracts (id, org_id, org_name, start_date, end_date, cash_value, cash_rate, cash_currency) values (?, ?, ?, ?, ?, ?, ?, ?)',
    add_system: 'INSERT OR REPLACE INTO systems(id) values (?)',
    add_contract_system_link: 'INSERT OR REPLACE INTO contract_system_link (contract_id, system_id) values (?, ?)',
    add_budget: 'INSERT OR REPLACE INTO budgets (id, base_hours, base_hours_spent, sla_quote_hours, additional_hours) values (?, ?, 0, 0, 0)',
    add_contract_budget_link: 'INSERT OR REPLACE INTO contract_budget_link(contract_id, budget_id) values (?, ?)',
    delete_contract_budgets: 'DELETE FROM budgets WHERE id IN (SELECT budget_id FROM contract_budget_link WHERE contract_id=?)',
    delete_contract_budget_links: 'DELETE FROM contract_budget_link WHERE contract_id=?',
    add_wr: 'INSERT OR REPLACE INTO wrs (id, system_id, created_on, brief, detailed, status, urgency, importance, hours, tag_unchargeable, tag_additional, tags, invoice_to) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    add_timesheet: 'INSERT OR REPLACE INTO timesheets(wr_id, budget_id, worked_on, hours) values (?, ?, ?, ?)',
    add_quote: 'INSERT OR REPLACE INTO quotes (id, budget_id, wr_id, approved_on, hours, additional, valid, approved) values (?, ?, ?, ?, ?, ?, ?, ?)',
    wrms: {
        // Must have same request_id order as quotes_for_system()
        wrs_for_system: (sys_arr) => {
            return `SELECT  r.request_id,
                            r.brief,
                            r.detailed,
                            r.request_on,
                            r.system_id,
                            stat.lookup_desc as status,
                            urg.lookup_desc as urgency,
                            imp.lookup_desc as importance,
                            ts.work_quantity AS timesheet_hours,
                            (
                                SELECT string_agg(otag.tag_description, ',')
                                FROM organisation_tag otag
                                JOIN request_tag rtag ON rtag.tag_id=otag.tag_id
                                WHERE rtag.request_id=r.request_id
                            ) as tags,
                            ts.work_on AS timesheet_date,
                            r.invoice_to
                    FROM request r
                    JOIN lookup_code stat on stat.source_table='request'
                       AND stat.source_field='status_code'
                       AND stat.lookup_code=r.last_status
                    JOIN lookup_code urg on urg.source_table='request'
                       AND urg.source_field='urgency'
                       AND urg.lookup_code=cast(r.urgency as text)
                    JOIN lookup_code imp on urg.source_table='request'
                       AND imp.source_field='importance'
                       AND imp.lookup_code=cast(r.importance as text)
                    LEFT JOIN request_timesheet ts ON r.request_id=ts.request_id
                    WHERE r.system_id in (${sys_arr.join(',')})
                    ORDER BY r.request_id,ts.work_on`
                    .replace(/\s+/g, ' ');
        },
        // Must have same request_id order as wrs_for_system()
        quotes_for_system: (sys_arr) => {
            return `SELECT  r.request_id,
                            q.quote_id,
                            CASE WHEN q.quote_units = 'days' THEN q.quote_amount*8
                                 ELSE q.quote_amount
                            END AS quote_amount,
                            q.approved_by_id,
                            q.quoted_on,
                            q.approved_on,
                            (q.quoted_on < current_date - interval '1 month') AS expired,
                            CASE WHEN q.quote_units = 'days' THEN 'hours'
                                 ELSE q.quote_units
                            END AS quote_units
                    FROM request r
                    JOIN request_quote q ON q.request_id=r.request_id
                    WHERE r.system_id in (${sys_arr.join(',')})
                    AND q.quote_cancelled_by IS NULL
                    ORDER BY r.request_id,q.quote_id`
                    .replace(/\s+/g, ' ');
        }
    }
}

