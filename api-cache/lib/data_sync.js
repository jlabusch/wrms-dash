var config  = require('config'),
    dbs     = require('./data_store_dbs'),
    espo    = require('./espo'),
    fs      = require('fs'),
    sql     = require('./data_store_sql'),
    sqlite_promise = require('./data_store_promise').promise,
    store   = require('./data_store'),
    su      = require('./data_sync_utils'),
    util    = require('wrms-dash-util'),
    qf      = util.quote_funcs,
    wrms    = require('wrms-dash-db').db.get();

'use strict';

let sync_active = true,
    first_run = true;

const DEBUG = false;

function push_org_data(){
    util.send_post({ url: config.get('api.host') + '/update_org_data' })
        .with(util.org_data.active().data)
        .then((err, data) => {
            if (err || data.error){
                util.log(__filename, `ERROR: couldn't update API org_data: ${err || data.error}`);
            }else{
                util.log_debug(__filename, `Sent updated org_data to API`, DEBUG);
            }
        });
}

async function run(){
    if (first_run){
        first_run = false;
        util.org_data.active().set_static_contracts(config.get('contracts'));
        push_org_data();
        await store.init();
    }

    const delay = config.get('sync.poll_interval_secs');

    let sync_start = new Date();

    if (sync_active){
        try{
            util.org_data.syncing().wipe();

            await sync();

            util.org_data.swap();
            dbs.swap();

            push_org_data();

            util.org_data.active().each(v => {
                util.log_debug(__filename, `${v.org_id}: ${v.name}`, DEBUG);
            });
            su.dump(dbs.active(), 'After swap');
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

                util.promise_sequence(sql.delete_all, s => {
                    return sqlite_promise(dbs.syncing(), s);
                }).then(() => {
                    util.promise_sequence(contracts, sync_contract, 0, util.ON_ERROR_CONTINUE).then(resolve, reject);
                });
            },
            reject
        );
    });
}

function sync_contract(c){
    util.log_debug(__filename, `sync_contract(${c.name})`, DEBUG);

    return new Promise((resolve, reject) => {
        create_contract(dbs.syncing(), c).then(
            fetch_wrs_from_wrms(resolve, reject, c),
            su.soft_failure(resolve, `ERROR creating contract ${c.name}: `)
        );
    });
}

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
            su.soft_failure(resolve, `ERROR getting WRs for systems ${JSON.stringify(contract.systems)}: `)
        );
    }
}

function format_timesheet_dates(resolve, reject, contract){
    return function(wrs){
        wrs.rows.forEach(r => {
            if (r.timesheet_date){
                // Convert to common short format. Also, lol timezones.
                r.timesheet_date = util.dates.date_fmt(new Date(r.timesheet_date.replace(/T\d\d:/, 'T12:')));
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
        su.soft_failure(resolve, `ERROR getting quotes for systems ${JSON.stringify(contract.systems)}: `)
    );
}

function process_wrms_data(resolve, reject, contract, wr_rows){
    function time_should_be_seen_by_clients(wr, has_quotes){
        return !wr.unchargeable && !wr.additional && !has_quotes[wr.request_id]
    }
    return async function(quotes){
        util.log_debug(__filename, `contract ${contract.name} quotes loaded`, DEBUG);

        let prev_wr = {request_id: undefined, additional: 0, unchargeable: 0};

        let has_quotes = {};

        let iq = 0;
        for (let iw = 0; iw < wr_rows.length; ++iw){
            let wr = wr_rows[iw];

            // If it's the first time we're seeing this WR, insert wrs row
            if (wr.request_id !== prev_wr.request_id){
                prev_wr = wr;

                util.log_debug(__filename, `contract ${contract.name} WR ${wr.request_id}: ${wr.brief} [${wr.status}] ${wr.tags || ''}`, DEBUG);

                su.set_wr_tags_from_string(wr, wr.tags);

                try{
                    await sqlite_promise(
                        dbs.syncing(),
                        sql.add_wr,
                        wr.request_id,
                        wr.system_id,
                        util.dates.date_fmt(new Date(wr.request_on)),
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
                    iw = su.find_last_row_for_this_wr(wr_rows, iw);
                    continue;
                }

                has_quotes[wr.request_id] = false;

                if (!wr.unchargeable){
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

                        // Don't modify the budget for real until we see sql.add_quote succeed.
                        await sqlite_promise(dbs.syncing(), 'BEGIN TRANSACTION');

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

                        // If there are (potentially) live quotes, find the appropriate contract budget
                        // (remembering the different ways of allocating quotes to months)
                        let budget = undefined;

                        try{
                            budget = await select_best_budget(contract, qdesc.period);
                            util.log_debug(__filename, `contract ${contract.name} quote ${q.quote_id} linked to budget ${JSON.stringify(budget, null, 2)}`, DEBUG);
                        }catch(err){
                            util.log(__filename, `ERROR finding quote budget for ${contract.name} period ${qdesc.period}: ${err}`);
                            await sqlite_promise(dbs.syncing(), 'ROLLBACK').catch(err => {});
                            continue;
                        }

                        // If the quote is approved, modify the budget in light of this quote
                        if (q.approved_by_id){
                            try{
                                await su.modify_budget_for_quote(budget, q, qdesc);
                            }catch(err){
                                util.log(__filename, `ERROR modifying budget for ${contract.name} period ${qdesc.period}: ${err}`);
                                await sqlite_promise(dbs.syncing(), 'ROLLBACK').catch(err => {});
                                continue;
                            }
                        }

                        try{
                            await su.add_quote(q, qdesc, budget, wr);
                        }catch(err){
                            util.log(__filename, `ERROR adding synced quote ${q.quote_id}: ${err}`);
                            await sqlite_promise(dbs.syncing(), 'ROLLBACK');
                            continue;
                        }
                        await sqlite_promise(dbs.syncing(), 'COMMIT').catch(err => {
                            util.log(__filename, `ERROR committing quote ${q.quote_id}: ${err}`);
                        });

                        if (su.quote_is_valid(q)){
                            has_quotes[wr.request_id] = true;
                        }
                    }
                }

                util.log_debug(__filename, 'Done processing quotes for WR ' + wr.request_id);
            }

            if (!wr.timesheet_hours){
                util.log_debug(__filename, 'No timesheets for WR ' + wr.request_id);
                continue;
            }
            util.log_debug(__filename, 'Processing timesheets for WR ' + wr.request_id, DEBUG);

            let total_timesheets = 0,
                timesheet_buckets = {},
                timesheet_budgets = {};

            // We only reach this point if there are no live quotes; add up the timesheets.
            for (; iw < wr_rows.length && wr_rows[iw].request_id === wr.request_id; ++iw){

                let iw_hours = wr_rows[iw].timesheet_hours,
                    iw_date = wr_rows[iw].timesheet_date;

                total_timesheets += iw_hours;

                util.log_debug(__filename, 'WR ' + wr.request_id + ' iw=' + iw + ' hours=' + total_timesheets + ' (+' + iw_hours + ')', DEBUG);

                // Find this period's budget and add timesheet hours to base_hours_spent.
                let iw_budget = undefined;
                if (time_should_be_seen_by_clients(wr, has_quotes)){
                    try{
                        iw_budget = await select_best_budget(contract, iw_date);
                    }catch(err){
                        util.log(__filename, `ERROR finding timesheet budget for ${contract.name} period ${iw_date}: ${err}`, DEBUG);
                        continue;
                    }

                    timesheet_budgets[iw_budget.id] = iw_budget;
                }

                let t = timesheet_buckets[iw_date] || {request_id: wr.request_id, hours: 0, date: iw_date};
                if (iw_budget && !t.budget){
                    t.budget = iw_budget.id;
                }
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

                    let n = buckets[ib].hours,
                        b = timesheet_budgets[buckets[ib].budget] || {id:null};

                    if (time_should_be_seen_by_clients(wr, has_quotes)){
                        n = util.round_to_half_hour(n);
                    }

                    total_timesheets += n;

                    try{
                        await sqlite_promise(
                            dbs.syncing(),
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

                    if (time_should_be_seen_by_clients(wr, has_quotes)){
                        try{
                            await sqlite_promise(
                                dbs.syncing(),
                                'UPDATE budgets SET base_hours_spent=base_hours_spent + ? WHERE id=?',
                                n,
                                b.id
                            );
                        }catch(err){
                            util.log(__filename, `ERROR modifying budget for ${contract.name} timesheet period ${buckets[ib].date}: ${err.message || err}`, DEBUG);
                            continue;
                        }
                    }
                }

                try{
                    await sqlite_promise(
                        dbs.syncing(),
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
    return new Promise((resolve, reject) => {
        if (!c){
            util.log(__filename, 'create_contract(null) => skipping');
            resolve(false);
            return;
        }
        util.log_debug(__filename, `create_contract(${c.name})`, DEBUG);

        util.promise_sequence(
            [
                su.add_new_contract_and_systems,
                su.add_budgets_for_contract
            ],
            fn => {
                return fn(db, c);
            }
        )
        .then(resolve)
        .catch(reject);
    });
}

// Order of preference:
//  - monthly budgets with hours available,
//  - then annual/biannual budgets, even if they have no hours available,
//  - then monthly budgets with no hours available,
//  - finally an ad-hoc 0-value monthly budget, created on the fly
function select_best_budget(contract, period){
    return new Promise((resolve, reject) => {
        dbs.syncing().all(
            // TODO FIXME: figure out the syntax of prepared statement with placeholder
            // containing % and using ESCAPE clause. Right now this is an easy sqli vector.
            `SELECT id,base_hours,base_hours_spent,sla_quote_hours,additional_hours FROM budgets WHERE id LIKE '${contract.name.replace(/'/, '')} %'`,
            (err, budgets) => {
                if (err){
                    reject(err);
                    return;
                }

                let monthly_name = util.naming.create_budget_name(contract, 'month', period);

                // First try to find an existing budget...
                if (Array.isArray(budgets) && budgets.length > 0){
                    let month_match = null,
                        annual_match = null;

                    budgets.forEach(budget => {
                        if (budget.id == monthly_name){
                            month_match = budget;
                        }else if (util.naming.match_non_monthly_budget_name(budget.id, {period:period})){
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
                sqlite_promise(dbs.syncing(), sql.add_budget, monthly_name, 0).then(
                    success => {
                        sqlite_promise(dbs.syncing(), sql.add_contract_budget_link, contract.name, monthly_name).then(
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

setTimeout(run, config.get('sync.startup_delay_secs')*1000);

module.exports = {
    pause: () => { sync_active = false },
    unpause: () => { sync_active = true }
}

