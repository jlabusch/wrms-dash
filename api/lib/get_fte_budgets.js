var store = require('./data_store'),
    sync  = require('./data_sync'),
    odata = require('./org_data'),
    util  = require('wrms-dash-util');

'use strict';

const DEBUG = false;

const budget_query = util.trim `SELECT  c.id AS contract,
                                        c.cash_value,
                                        c.cash_rate,
                                        c.cash_currency,
                                        b.id AS budget,
                                        b.base_hours,
                                        b.base_hours_spent,
                                        b.additional_hours
                                FROM    budgets b
                                JOIN    contract_budget_link cb ON cb.budget_id=b.id
                                JOIN    contracts c ON c.id=cb.contract_id`;

const time_query = util.trim   `SELECT  w.id as request_id,
                                        t.worked_on AS month,
                                        t.hours,
                                        w.tag_unchargeable,
                                        w.tag_additional,
                                        cs.contract_id AS contract
                                FROM    timesheets t
                                JOIN    wrs w ON w.id=t.wr_id
                                JOIN    contract_system_link cs ON cs.system_id=w.system_id`;

// Data structure is
//
// {
//   periods: [
//     <YYYY-MM>(-0): {
//       month: <YYYY-MM>(-0),
//       sla_budget: {                  // SLA hours from contract (contract.base_hours)
//         <contract-name-1>: xxx
//         total: yyy
//       },
//       sla_hours_committed: { ... },  // quoted+unquoted SLA time (contract.base_hours_spent - matches client dash)
//       sla_hours: { ... },            // timesheets on SLA WRs (i.e. unquoted time + actual time on quoted WRs,
//                                      // not trusting contract.sla_quote_hours)
//       additional_budget: { ... },    // approved quotes on Additional WRs (contract.additional_hours - matches client dash)
//       additional_hours: { ... },     // timesheets on Additional WRs
//       unchargeable_hours: { ... },   // timesheets on unchargeable WRs (maintenance + warranty)
//       sla_fee_hours: { ... },        // cash_value/contract length/cash_rate, which needs to
//                                      // cover base_hours_spent + unchargeable_hours
//     },
//     <YYYY-MM>(-1): { ... }
//   ],
//   contracts: [ <contract-name-1>, ...  ]
// }
function create_periods(){
    let periods = {};

    for (let n = 0; n < 12; ++n){
        let d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - n);

        let p = d.getFullYear() + '-' + (d.getMonth()+1);
        periods[p] = {
            month: p
        };

        [
            'sla_budget',
            'sla_hours_committed',
            'sla_hours',
            'additional_budget',
            'additional_hours',
            'unchargeable_hours',
            'sla_fee_hours'
        ].forEach(f => {
            periods[p][f] = {total: 0};
        });
    }

    return periods;
}

function add_field(period, field, value, contract){
    period[field].total += value;

    let n = period[field][contract] || 0;
    n += value;
    period[field][contract] = n;

    util.log_debug(__filename, `${period.month} -> ${field} += ${value} (now ${period[field][contract]} ${contract}, ${period[field].total} total)`, DEBUG);
}

function add_budget(period, values, contract){
    contract = contract || values.contract;

    [
        ['sla_budget',          'base_hours'],
        ['sla_hours_committed', 'base_hours_spent'],
        ['additional_budget',   'additional_hours']
    ].forEach(f => {
        add_field(period, f[0], values[f[1]], contract)
    });
}

function handle_budget_data(data){
    let periods = create_periods(),
        contracts = {};

    data.forEach(row => {
        let month_match = row.budget.match(/month\s+(\d\d\d\d-\d?\d)$/);

        if (month_match && periods[month_match[1]]){
            const mm = month_match[1];

            // Add the time to one specific month
            add_budget(periods[mm], row);
            add_field(periods[mm], 'sla_fee_hours', row.cash_value/row.cash_rate, row.contract);
            contracts[row.contract] = true;
            return;
        }

        let other_match = row.budget.match(/(..annual)\s+(\d\d\d\d-\d?\d)\s+to\s+(\d\d\d\d-\d?\d)$/);

        if (other_match){
            // Distribute the time evenly over the length of the contract
            // and add the time to the contract months that fall into the
            // 12 month period we're looking at.
            let divisor = other_match[1] === 'biannual' ? 6 : 12,
                values = {},
                from = new Date(other_match[2]),
                to = new Date(other_match[3]);

            [
                'base_hours',
                'base_hours_spent',
                'additional_hours'
            ].forEach(f => {
                values[f] = row[f]/divisor;
            });

            Object.values(periods).forEach(p => {
                let pdate = new Date(p.month);
                // Should this be exclusive of "to"? Depends on human conventions in CRM.
                if (pdate >= from && pdate <= to){
                    add_budget(p, values, row.contract);
                    add_field(p, 'sla_fee_hours', row.cash_value/row.cash_rate, row.contract);
                    contracts[row.contract] = true;
                }
            });
        }
    });

    return {
        periods: periods,
        contracts: Object.keys(contracts)
    };
}

function include_timesheet_data(result, data){
    data.forEach(row => {
        if (result.periods[row.month]){
            util.log_debug(__filename, `FTE ${row.contract},${row.month},${row.request_id},${row.hours}`, DEBUG);
            if (row.tag_additional){
                add_field(result.periods[row.month], 'additional_hours', row.hours, row.contract);
            }else if (row.tag_unchargeable){
                add_field(result.periods[row.month], 'unchargeable_hours', row.hours, row.contract);
            }else{
                add_field(result.periods[row.month], 'sla_hours', row.hours, row.contract);
            }
        }
    });
}

module.exports = function(req, res, next, ctx){
    if (util.send_err_if_not_vendor(req, res, next, ctx, __filename)){
        return;
    }

    function send_err(e){ store.query_send_error(res, next, e, __filename) }

    function send_err_if_invalid(e, d, msg){
        if (e){
            send_err(e);
            return true;
        }
        if (!Array.isArray(d)){
            send_err(new Error(msg));
            return true;
        }
        return false;
    }

    store.query(
        budget_query,
        (err, data) => {
            if (send_err_if_invalid(err, data, "Couldn't query budgets.")){
                return;
            }

            let result = handle_budget_data(data);

            store.query(
                time_query,
                (err, data) => {
                    if (send_err_if_invalid(err, data, "Couldn't query timesheets.")){
                        return;
                    }

                    include_timesheet_data(result, data);

                    result.periods = Object.values(result.periods);

                    store.query_send_data(res, next, result, __filename);
                }
            );
        }
    );

}

