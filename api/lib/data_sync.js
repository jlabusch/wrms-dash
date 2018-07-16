var config  = require('config'),
    org_data= require('./org_data'),
    util    = require('./util'),
    fs      = require('fs'),
    store   = require('./data_store'),
    espo    = require('./espo'),
    qf      = require('./quote_funcs'),
    wrms    = require('./db').get();

'use strict';

let sync_active = true,
    first_run = true,
    sqlite_promise = store.sqlite_promise,
    sql = store.sql;

const DEBUG = true;

// select_best_budget() relies on this key composition.
function create_budget_name(contract, type, period){
    return contract.name + ' ' + type + ' ' + period;
}

function match_non_monthly_budget_name(id, ctx){
    // Matches both annaul and biannual
    let m = id.match(/annual (\d\d\d\d-\d?\d) to (\d\d\d\d-\d?\d)/);

    if (m){
        let from = new Date(m[1]),
            to = new Date(m[2]);

        // force "to" to be the end of the month
        to.setMonth(to.getMonth()+1);
        to.setDate(-1);

        let pdate = new Date(ctx.period);

        return pdate > from && pdate < to;
    }
    return false;
}

async function run(){
    util.log_debug(__filename, 'run()', DEBUG);
    if (first_run){
        first_run = false;
        await store.init();
    }

    const delay = config.get('sync.poll_interval_secs');

    let sync_start = new Date();

    if (sync_active){
        try{
            await sync();
            // store.dbs.syncing is now fresh, make it active.
            store.swap();
            dump(store.dbs.active, 'After swap');
            util.log_debug(__filename, 'sync complete', DEBUG);
        }catch(err){
            util.log(__filename, 'sync error, keeping current DB active');
            util.log(__filename, 'ERROR: ' + err.message);
            util.log(__filename, 'ERROR: ' + err.stack);
        }
    }

    let sync_end = new Date();

    util.log(__filename, `Sync complete in ${Math.round((sync_end - sync_start)/100)/10} sec, next attempt in ${delay} sec`);

    setTimeout(run, delay*1000);
}

function sync(){
    util.log_debug(__filename, 'sync()', DEBUG);

    return new Promise((resolve, reject) => {
        get_contracts().then(
            contracts => {
                if (!contracts || !Array.isArray(contracts)){
                    util.log(__filename, 'No contracts to process.');
                    return;
                }
                util.promise_sequence(contracts, sync_contract, 0, util.ON_ERROR_CONTINUE).then(resolve, reject);
            },
            reject
        );
    });
}

function dump_rows_as_csv(rows){
    if (Array.isArray(rows) && rows.length > 0){
        console.log(Object.keys(rows[0]).join(','));
        rows.forEach(row => {
            console.log(Object.values(row).join(','));
        });
    }
}

function dump(db, label = ''){
    if (!DEBUG){
        return;
    }
    Object.keys(sql.dump).forEach(key => {
        db.all(
            sql.dump[key],
            (err, res) => {
                if (err){
                    util.log(__filename, `ERROR in dump()/${key}: ${err.message || err}`);
                    return;
                }
                console.log('======================== ' + label + ' ========================');
                dump_rows_as_csv(res);
            }
        );
    });
}

function sync_contract(c){
    util.log_debug(__filename, `sync_contract(${c.name})`, DEBUG);

    return new Promise((resolve, reject) => {
        create_contract(store.dbs.syncing, c).then(
            fetch_wrs_from_wrms(resolve, reject, c),
            soft_failure(resolve, `ERROR creating contract ${c.name}: `)
        );
    });

    function fetch_wrs_from_wrms(resolve, reject, contract){
        return function(){
            util.log_debug(__filename, `contract ${contract.name} created`, DEBUG);

            if (contract.org_name === '__vendor'){
                util.log(__filename, 'skipping detail of __vendor contract');
                resolve(true)
                return;
            }

            if (!contract.systems || contract.systems.length < 1){
                reject(new Error("No WRMS systems in contract " + contract.name));
                return;
            }

            // We're not clamping the WRMS data to contract.start_date/contract.end_date because
            // we don't want to miss anything, and our workflow has a 1:1 correlation
            // between contracts and systems anyway.
            let key = 'sync-sys-wrs-' + JSON.stringify(contract.systems),
                stmt = sql.wrms.wrs_for_system(contract.systems);

            util.log_debug(__filename, stmt);

            wrms.query(
                key,
                stmt,
                null // no context for this call
            ).then(
                format_timesheet_dates(resolve, reject, contract),
                soft_failure(resolve, `ERROR getting WRs for systems ${JSON.stringify(contract.systems)}: `)
            );
        }
    }

    function format_timesheet_dates(resolve, reject, contract){
        return function(wrs){
            wrs.rows.forEach(r => {
                if (r.timesheet_date){
                    // Convert to common short format. Also, lol timezones.
                    r.timesheet_date = util.date_fmt(new Date(r.timesheet_date.replace(/T\d\d:/, 'T12:')));
                }
                //util.log_debug(__filename, [r.request_id,r.system_id,r.timesheet_hours,r.timesheet_date,r.tags].join(','), DEBUG);
            });
            util.log_debug(__filename, `contract ${contract.name} WRs and timesheets loaded`, DEBUG);
            fetch_quotes_from_wrms(resolve, reject, contract, wrs.rows);
        }
    }

    function fetch_quotes_from_wrms(resolve, reject, contract, wr_rows){
        let key = 'sync-sys-quotes-' + JSON.stringify(contract.systems);
        wrms.query(
            key,
            sql.wrms.quotes_for_system(contract.systems),
            null // no context for this call
        ).then(
            process_wrms_data(resolve, reject, contract, wr_rows),
            soft_failure(resolve, `ERROR getting quotes for systems ${JSON.stringify(contract.systems)}: `)
        );
    }

    function process_wrms_data(resolve, reject, contract, wr_rows){
        return async function(quotes){
            util.log_debug(__filename, `contract ${contract.name} quotes loaded`, DEBUG);

            let prev_wr = {request_id: undefined, additional: 0, unchargeable: 0};

            let iq = 0;
            for (let iw = 0; iw < wr_rows.length; ++iw){
                let wr = wr_rows[iw];

                // If it's the first time we're seeing this WR, insert wrs row
                if (wr.request_id !== prev_wr.request_id){
                    prev_wr = wr;

                    util.log_debug(__filename, `contract ${contract.name} WR ${wr.request_id}: ${wr.brief} [${wr.status}] ${wr.tags || ''}`, DEBUG);

                    wr.additional = false;
                    wr.unchargeable = false;

                    if (wr.tags){
                        wr.additional = wr.tags.includes('Additional');
                        wr.unchargeable = wr.tags.includes('Warranty') || wr.tags.includes('Maintenance');
                    }

                    try{
                        await sqlite_promise(
                            store.dbs.syncing,
                            sql.add_wr,
                            wr.request_id,
                            wr.system_id,
                            util.date_fmt(new Date(wr.request_on)),
                            wr.brief,
                            wr.detailed,
                            wr.status,
                            wr.urgency,
                            wr.importance,
                            0, // only fill in timesheet hours if there are no quotes
                            wr.unchargeable|0,
                            wr.additional|0,
                            wr.tags,
                            wr.invoice_to
                        );
                    }catch(err){
                        util.log(__filename, `ERROR adding synced WR ${wr.request_id}: ${err}`);
                        iw = find_last_row_for_this_wr(wr_rows, iw);
                        continue;
                    }

                    if (wr.unchargeable){
                        util.log_debug(__filename, `WR ${wr.request_id} not chargeable, skipping quotes and timesheets`);
                        iw = find_last_row_for_this_wr(wr_rows, iw);
                        continue;
                    }

                    let has_quotes = false;

                    // Find quotes for this WR
                    util.log_debug(__filename, 'Finding quotes for WR ' + wr.request_id, DEBUG);
                    while (iq < quotes.rows.length && quotes.rows[iq].request_id < wr.request_id){
                        util.log_debug(__filename, `iq=${iq}, quotes.request_id=${quotes.rows[iq].request_id}`, DEBUG);
                        ++iq;
                    }
                    // If anything goes wrong, don't skip ahead to next WR like we do above, keep processing
                    // quotes in sequence.
                    for (; iq < quotes.rows.length && quotes.rows[iq].request_id === wr.request_id; ++iq){
                        let q = quotes.rows[iq];
                        util.log_debug(__filename, `contract ${contract.name} quote ${q.quote_id}`, DEBUG);

                        if (q.quote_units !== 'hours'){
                            continue;
                        }

                        // If there are (potentially) live quotes, find the appropriate contract budget
                        // (remembering the different ways of allocating quotes to months)
                        let budget = undefined;

                        // Don't modify the budget for real until we see sql.add_quote succeed.
                        await sqlite_promise(store.dbs.syncing, 'BEGIN TRANSACTION');

                        util.log_debug(__filename, `contract ${contract.name} quote ${JSON.stringify(q)} will be added`, DEBUG);

                        let qdesc = qf.describe_quote({
                            approved_on: q.approved_on,
                            quoted_on: q.quoted_on,
                            tags: wr.tags,
                            invoice_to: wr.invoice_to,
                            request_id: wr.request_id,
                            quote_id: q.quote_id
                        });

                        util.log_debug(__filename, `contract ${contract.name} quote ${q.quote_id} description: ${JSON.stringify(qdesc)}`, DEBUG);

                        try{
                            budget = await select_best_budget(contract, qdesc.period);
                            util.log_debug(__filename, `contract ${contract.name} quote ${q.quote_id} linked to budget ${JSON.stringify(budget, null, 2)}`, DEBUG);
                        }catch(err){
                            util.log(__filename, `ERROR finding quote budget for ${contract.name} period ${qdesc.period}: ${err}`);
                            await sqlite_promise(store.dbs.syncing, 'ROLLBACK').catch(err => {});
                            continue;
                        }

                        // If the quote is approved, modify the budget in light of this quote
                        if (q.approved_by_id){
                            try{
                                await modify_budget_for_quote(budget, q, qdesc);
                            }catch(err){
                                util.log(__filename, `ERROR modifying budget for ${contract.name} period ${qdesc.period}: ${err}`);
                                await sqlite_promise(store.dbs.syncing, 'ROLLBACK').catch(err => {});
                                continue;
                            }
                        }

                        try{
                            await add_quote(q, qdesc, budget, wr);
                        }catch(err){
                            util.log(__filename, `ERROR adding synced quote ${q.quote_id}: ${err}`);
                            await sqlite_promise(store.dbs.syncing, 'ROLLBACK');
                            continue;
                        }
                        await sqlite_promise(store.dbs.syncing, 'COMMIT').catch(err => {
                            util.log(__filename, `ERROR committing quote ${q.quote_id}: ${err}`);
                        });

                        if (quote_is_valid(q)){
                            has_quotes = true;
                        }
                    }

                    util.log_debug(__filename, 'Done processing quotes for WR ' + wr.request_id);

                    if (has_quotes){
                        util.log_debug(__filename, `WR ${wr.request_id} has quotes, so skipping timesheets`);
                        iw = find_last_row_for_this_wr(wr_rows, iw);
                        continue;
                    }
                }

                if (!wr.timesheet_hours){
                    util.log_debug(__filename, 'No timesheets for WR ' + wr.request_id);
                    continue;
                }
                util.log_debug(__filename, 'Processing timesheets for WR ' + wr.request_id, DEBUG);

                let total_timesheets = 0,
                    timesheet_buckets = {},
                    timesheet_budgets = {};

                // We only reach this point if there are no live quotes.
                for (; iw < wr_rows.length && wr_rows[iw].request_id === wr.request_id; ++iw){

                    let iw_hours = wr_rows[iw].timesheet_hours,
                        iw_date = wr_rows[iw].timesheet_date;

                    total_timesheets += iw_hours;

                    util.log_debug(__filename, 'WR ' + wr.request_id + ' iw=' + iw + ' hours=' + total_timesheets + ' (+' + iw_hours + ')', DEBUG);

                    // Find this period's budget and add timesheet hours to base_hours_spent.
                    let iw_budget = undefined;
                    try{
                        iw_budget = await select_best_budget(contract, iw_date);
                    }catch(err){
                        util.log(__filename, `ERROR finding timesheet budget for ${contract.name} period ${iw_date}: ${err}`, DEBUG);
                        continue;
                    }

                    timesheet_budgets[iw_budget.id] = iw_budget;

                    let t = timesheet_buckets[iw_date] || {request_id: wr.request_id, hours: 0, budget: iw_budget.id, date: iw_date};
                    t.hours += iw_hours;
                    timesheet_buckets[iw_date] = t;
                }
                if (total_timesheets){ // then we incremented iw until the while() condition failed
                    // Take it back a step so the outer loop works as expected.
                    --iw;

                    let buckets = Object.values(timesheet_buckets);

                    // recalculate total_timesheets based on sum of rounded buckets so all our numbers are consistent
                    total_timesheets = 0;

                    for (let ib = 0; ib < buckets.length; ++ib){

                        let n = util.round_to_half_hour(buckets[ib].hours),
                            b = timesheet_budgets[buckets[ib].budget];

                        total_timesheets += n;

                        try{
                            await sqlite_promise(
                                store.dbs.syncing,
                                sql.add_timesheet,
                                buckets[ib].request_id,
                                b.id,
                                buckets[ib].date,
                                n
                            );
                        }catch(err){
                            util.log(__filename, `ERROR adding timesheet for ${contract.name} timesheet period ${buckets[ib].date}: ${err.message || err}`, DEBUG);
                            continue;
                        }

                        try{
                            await sqlite_promise(
                                store.dbs.syncing,
                                'UPDATE budgets SET base_hours_spent=? WHERE id=?',
                                b.base_hours_spent + n,
                                b.id
                            );
                        }catch(err){
                            util.log(__filename, `ERROR modifying budget for ${contract.name} timesheet period ${buckets[ib].date}: ${err.message || err}`, DEBUG);
                            continue;
                        }
                    }

                    try{
                        await sqlite_promise(
                            store.dbs.syncing,
                            'UPDATE wrs SET hours=? WHERE id=?',
                            total_timesheets,
                            wr_rows[iw].request_id
                        );
                    }catch(err){
                        util.log(__filename, `ERROR modifying budget for ${contract.name} timesheet period ${wr.timesheet_date}: ${err.message || err}`, DEBUG);
                    }
                }
            }
            util.log_debug(__filename, 'Done processing WRs for contract ' + contract.name, DEBUG);
            resolve(true);
        }
    }

    // Soft failures shouldn't stop the other contracts from being created.
    function soft_failure(resolve , msg){
        return function(err){
            util.log(__filename, msg + (err.message || err));
            resolve(false);
        }
    }
}

// Loads contracts from the static config (config.contracts) and then optionally also
// from Espo CRM (config.espo.enabled) file (config.contracts). It but WILL pick up runtime
// contract changes, it doesn't use require('config').
//
// Resolves with
// [
//   {
//     "org_id": 1234,
//     "org_name": "Foo Corp",
//     "name": "Foo SLA",
//     "type": "monthly",
//     "hours": 30,
//     "start_date": "1 June 2018",
//     "end_date": "31 May 2020",
//     "systems": [ 5678 ]
//   }
// ]
function get_contracts(){
    util.log_debug(__filename, 'get_contracts()', DEBUG);

    return load_static_contracts().then(cfg_data => {
        if (config.get('espo.enabled')){
            return espo.fetch_contracts().then(espo_data => {
                return cfg_data.concat(espo_data);
            });;
        }
        return cfg_data;
    });
}

function load_static_contracts(){
    return new Promise((resolve, reject) => {
        let f = './config/default.json';
        try{
            f = config.util.getConfigSources()[0].name;
        }catch(ex){
            log(__filename, 'ERROR determining config sources: ' + ex + ' - using default');
        }
        util.log_debug(__filename, 'reading contracts from ' + f);
        fs.readFile(f, (err, data) => {
            if (err){
                reject(err);
            }
            try{
                let json = JSON.parse(data);
                util.log_debug(__filename, JSON.stringify(json.contracts, null, 2));
                resolve(json.contracts);
            }catch(ex){
                reject(ex);
            }
        });
    });
}

// Create the inferred/non-quote budgets.
function create_contract(db, c){
    async function do_create_contract(resolve, reject){
        if (!c){
            util.log(__filename, 'create_contract(null) => skipping');
            resolve(false);
            return;
        }
        util.log_debug(__filename, `create_contract(${c.name})`, DEBUG);

        try{
            await sqlite_promise(db, sql.delete_contract_budgets, c.name);
            await sqlite_promise(db, sql.delete_contract_budget_links, c.name);
        }catch(err){
            reject(err);
            return;
        }

        try{
            org_data.add_org(c);
            await sqlite_promise(db, sql.add_contract, c.name, c.org_id, c.org_name, c.start_date, c.end_date);

            for (let i = 0; i < c.systems.length; ++i){
                org_data.add_system(c, c.systems[i]);
                await sqlite_promise(db, sql.add_system, c.systems[i]);
                await sqlite_promise(db, sql.add_contract_system_link, c.name, c.systems[i]);
            }

            let current = new Date(c.start_date),
                end = new Date(c.end_date);

            // For more reliable date incrementing:
            current.setDate(1);
            current.setHours(8);
            // And disambiguate contracts that end on the last day of the month
            end.setDate(end.getDate()+1);

            while (current < end){
                let this_month = util.date_fmt(current),
                    key = null;

                switch(c.type){
                    case 'monthly':
                        current.setMonth(current.getMonth()+1);
                        key = create_budget_name(c, 'month', this_month);
                        break;
                    case '6 monthly':
                        current.setMonth(current.getMonth()+6);
                        key = create_budget_name(c, 'biannual', this_month + ' to ' + util.date_fmt(current));
                        break;
                    case 'annually':
                        current.setMonth(current.getMonth()+12);
                        key = create_budget_name(c, 'annual', this_month + ' to ' + util.date_fmt(current));
                        break;
                    default:
                        current = end;
                        reject(new Error('Unsupported contract type "' + c.type + '"'));
                        continue;
                }

                await sqlite_promise(db, sql.add_budget, key, c.hours);
                await sqlite_promise(db, sql.add_contract_budget_link, c.name, key);
            }

            resolve(true);
        }catch(err){
            reject(err);
        } 
    };
    return new Promise(do_create_contract);
}

function find_last_row_for_this_wr(arr, i){
    let id = arr[i].request_id;
    while (i < arr.length && arr[i].request_id === id){
        ++i;
    }
    return i-1;
}

// Order of preference:
//  - monthly budgets with hours available,
//  - then annual/biannual budgets, even if they have no hours available,
//  - then monthly budgets with no hours available,
//  - finally an ad-hoc 0-value monthly budget, created on the fly
function select_best_budget(contract, period){
    return new Promise((resolve, reject) => {
        store.dbs.syncing.all(
            // TODO FIXME: figure out the syntax of prepared statement with placeholder
            // containing % and using ESCAPE clause. Right now this is an easy sqli vector.
            `SELECT id,base_hours,base_hours_spent,sla_quote_hours,additional_hours FROM budgets WHERE id LIKE '${contract.name} %'`,
            (err, budgets) => {
                if (err){
                    reject(err);
                    return;
                }

                let monthly_name = create_budget_name(contract, 'month', period);

                // First try to find an existing budget...
                if (Array.isArray(budgets) && budgets.length > 0){
                    let month_match = null,
                        annual_match = null;

                    budgets.forEach(budget => {
                        if (budget.id == monthly_name){
                            month_match = budget;
                        }else if (match_non_monthly_budget_name(budget.id, {period:period})){
                            annual_match = budget;
                        }
                    });

                    if (month_match && month_match.base_hours > month_match.base_hours_spent){
                        util.log_debug(__filename, 'select_best_budget() matching monthly option: ' + month_match.id, DEBUG);
                        resolve(month_match);
                        return;
                    }

                    if (annual_match){
                        util.log_debug(__filename, 'select_best_budget() matching annual option: ' + annual_match.id, DEBUG);
                        resolve(annual_match);
                        return;
                    }

                    if (month_match){
                        util.log_debug(__filename, 'select_best_budget() matching monthly option even though no budget remains: ' + month_match.id, DEBUG);
                        resolve(month_match);
                        return;
                    }

                }

                util.log_debug(__filename, `No budgets of any kind found for ${contract.name} in ${period}, creating...`);

                // Create a budget and link it to the contract
                sqlite_promise(store.dbs.syncing, sql.add_budget, monthly_name, 0).then(
                    success => {
                        sqlite_promise(store.dbs.syncing, sql.add_contract_budget_link, contract.name, monthly_name).then(
                            success => {
                                resolve({id: monthly_name, base_hours: 0, sla_quote_hours: 0, additional_hours: 0, base_hours_spent: 0});
                            },
                            reject
                        );
                    },
                    reject
                );
            }
        );
    });
}

/*
function select_monthly_budget(contract, period){
    return new Promise((resolve, reject) => {
        let budget_name = create_budget_name(contract, 'month', period);
        store.dbs.syncing.all(
            'SELECT id,base_hours,base_hours_spent,sla_quote_hours,additional_hours FROM budgets WHERE id=?',
            budget_name,
            (err, budget) => {
                if (err){
                    reject(err);
                    return;
                }
                util.log_debug(__filename, 'select_monthly_budget() ' + JSON.stringify(budget, null, 2));
                if (!Array.isArray(budget) || budget.length < 1){
                    util.log_debug(__filename, `No monthly budget found for ${budget_name}, creating...`);
                    // Create a budget and link it to the contract
                    sqlite_promise(store.dbs.syncing, sql.add_budget, budget_name, 0).then(
                        success => {
                            sqlite_promise(store.dbs.syncing, sql.add_contract_budget_link, contract.name, budget_name).then(
                                success => {
                                    resolve({id: budget_name, base_hours: 0, sla_quote_hours: 0, additional_hours: 0, base_hours_spent: 0});
                                },
                                reject
                            );
                        },
                        reject
                    );
                }else{
                    resolve(budget[0]);
                }
            }
        );
    });
}
*/

function modify_budget_for_quote(budget, quote, quote_description){
    if (quote_description.additional){
        // Additional quote hours are recorded as a separate tally on additional_hours
        return sqlite_promise(
            store.dbs.syncing,
            'UPDATE budgets SET additional_hours=? WHERE id=?',
            budget.additional_hours + quote.quote_amount,
            budget.id
        );
    }else{
        // SLA quote hours are subtracted from base_hours as base_hours_spent
        return sqlite_promise(
            store.dbs.syncing,
            'UPDATE budgets SET base_hours_spent=?, sla_quote_hours=? WHERE id=?',
            budget.base_hours_spent + quote.quote_amount,
            budget.sla_quote_hours + quote.quote_amount,
            budget.id
        );
    }
}

function quote_is_valid(quote){
    return !!quote.approved_by_id || !quote.expired;
}

function add_quote(quote, desc, budget, wr){
    util.log_debug(__filename, `add_quote(${JSON.stringify(quote)})`, DEBUG);

    return sqlite_promise(
        store.dbs.syncing,
        sql.add_quote,
        quote.quote_id,
        budget.id,
        quote.request_id,
        util.date_fmt(new Date(desc.period)), // take wrs.invoice_to and quotes.approved_on into account
        quote.quote_amount,
        desc.additional|0,
        quote_is_valid(quote)|0,
        !!quote.approved_by_id|0
    );
}

setTimeout(run, config.get('sync.startup_delay_secs')*1000);

module.exports = {
    create_budget_name: create_budget_name,
    match_non_monthly_budget_name: match_non_monthly_budget_name,
    pause: () => { sync_active = false },
    unpause: () => { sync_active = true }
}

