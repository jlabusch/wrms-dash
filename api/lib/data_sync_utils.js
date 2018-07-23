var config  = require('config'),
    org_data= require('./org_data'),
    util    = require('./util'),
    fs      = require('fs'),
    store   = require('./data_store'),
    espo    = require('./espo');

'use strict';

let sync_active = true,
    first_run = true,
    sqlite_promise = store.sqlite_promise,
    sql = store.sql;

const DEBUG = false;

// select_best_budget() relies on this key composition.
function create_budget_name(contract, type, period){
    return contract.name + ' ' + type + ' ' + period;
}

exports.create_budget_name = create_budget_name;

function match_non_monthly_budget_name(id, ctx){
    // Matches both annaul and biannual
    let m = id.match(/annual (\d\d\d\d-\d?\d) to (\d\d\d\d-\d?\d)/);

    if (m){
        let from = new Date(m[1]),
            to = new Date(m[2]);

        let pdate = new Date(ctx.period);

        // Budget names are [start,end)
        return pdate >= from && pdate < to;
    }
    return false;
}

exports.match_non_monthly_budget_name = match_non_monthly_budget_name;

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

exports.dump = dump;

function set_wr_tags_from_string(wr, str){
    wr.additional = false;
    wr.unchargeable = false;

    if (str){
        wr.additional = str.includes('Additional');
        wr.unchargeable = str.includes('Warranty') || str.includes('Maintenance');
    }

    return wr;
}

exports.set_wr_tags_from_string = set_wr_tags_from_string;

// Soft failures shouldn't stop the other contracts from being created.
function soft_failure(resolve , msg){
    return function(err){
        util.log(__filename, msg + (err.message || err));
        resolve(false);
    }
}

exports.soft_failure = soft_failure;

function remove_previous_contract_budgets(db, contract){
    let stmts = [
        sql.delete_contract_budgets,
        sql.delete_contract_budget_links
    ];
    return util.promise_sequence(stmts, s => {
        return sqlite_promise(db, s, contract.name);
    });
}

exports.remove_previous_contract_budgets = remove_previous_contract_budgets;

function add_new_contract_and_systems(db, contract){
    let stmt_fns = [];

    org_data.add_org(contract);
    stmt_fns.push(store.generate_sqlite_promise(db, sql.add_contract, contract.name, contract.org_id, contract.org_name, contract.start_date, contract.end_date));

    for (let i = 0; i < contract.systems.length; ++i){
        org_data.add_system(contract, contract.systems[i]);
        stmt_fns.push(store.generate_sqlite_promise(db, sql.add_system, contract.systems[i]));
        stmt_fns.push(store.generate_sqlite_promise(db, sql.add_contract_system_link, contract.name, contract.systems[i]));
    }

    return util.promise_sequence(stmt_fns, fn => {
        return fn();
    });
}

exports.add_new_contract_and_systems = add_new_contract_and_systems;

function add_budgets_for_contract(db, contract){
    let current = new Date(contract.start_date),
        end = new Date(contract.end_date),
        stmt_fns = [];

    // For more reliable date incrementing:
    current.setDate(1);
    current.setHours(8);
    // And disambiguate contracts that end on the last day of the month
    end.setDate(end.getDate()+1);

    while (current < end){
        let [err, key] = make_budget_name_and_increment_date(contract, current, end);
        if (err){
            return err;
        }else{
            stmt_fns.push(store.generate_sqlite_promise(db, sql.add_budget, key, contract.hours));
            stmt_fns.push(store.generate_sqlite_promise(db, sql.add_contract_budget_link, contract.name, key));
        }
    }

    return util.promise_sequence(stmt_fns, fn => {
        return fn();
    });
}

exports.add_budgets_for_contract = add_budgets_for_contract;

function make_budget_name_and_increment_date(contract, current, end){
    let this_month = util.date_fmt(current),
        key = null;

    switch(contract.type){
        case 'monthly':
            current.setMonth(current.getMonth()+1);
            key = create_budget_name(contract, 'month', this_month);
            break;
        case '6 monthly':
            current.setMonth(current.getMonth()+6);
            key = create_budget_name(contract, 'biannual', this_month + ' to ' + util.date_fmt(current));
            break;
        case 'annually':
            current.setMonth(current.getMonth()+12);
            key = create_budget_name(contract, 'annual', this_month + ' to ' + util.date_fmt(current));
            break;
        default:
            contract.setTime(end.getTime());
            return [new Error(`Unsupported contract type "${contract.type}"`)];
    }
    return [null, key];
}

function find_last_row_for_this_wr(arr, i){
    let id = arr[i].request_id;
    while (i < arr.length && arr[i].request_id === id){
        ++i;
    }
    return i-1;
}

exports.find_last_row_for_this_wr = find_last_row_for_this_wr;

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

exports.modify_budget_for_quote = modify_budget_for_quote;

function quote_is_valid(quote){
    return !!quote.approved_by_id || !quote.expired;
}

exports.quote_is_valid = quote_is_valid;

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

exports.add_quote = add_quote;

