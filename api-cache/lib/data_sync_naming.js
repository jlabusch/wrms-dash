// select_best_budget() relies on this key composition.
function create_budget_name(contract, type, period){
    return contract.name + ' ' + type + ' ' + period;
}

exports.create_budget_name = create_budget_name;

function match_non_monthly_budget_name(id, ctx){
    // Matches both annaul and biannual
    let m = id.match(/annual (\d\d\d\d-\d?\d) to (\d\d\d\d-\d?\d)$/);

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


