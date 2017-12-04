URI_EXT = 'Catalyst%20EU/default/2017-7';

var FIRST_LOAD = true;

function render(name, i, color){
    $('.chart-wrapper:eq(' + i + ')').html(
        '<a href="/dashboard/' + name + '/"><div class="index-tile ' + color + '">' + name + '</div></a>'
    );
}

function make_renderer(name, i){
    return function(qerr) {
        if (qerr){
            console.log('sla_quotes: ' + JSON.stringify(qerr));
            return;
        }
        query("/sla_hours",
            function(cerr, data) {
                if (cerr){
                    console.log('sla_quotes: ' + JSON.stringify(qerr));
                    return;
                }
                if (!data.budget){
                    console.log(name + ' has no budget, not applying color');
                    return;
                }
                if (!data.result || data.result.length < 3){
                    console.log(name + ' has invalid "result" array for client data, not applying color');
                    return;
                }
                var budget = data.budget,
                    total = data.result[0][1] /* quoted */ +
                            data.result[1][1] /* unquoted */,
                    color = "red";

                if (total < budget * 0.75) {
                    color = "green";
                } else if (total < budget) {
                    color = "yellow";
                }

                render(name, i, color);
            },
            undefined,
            undefined,
            name + "/default/" + PERIOD);
    }
}

function fetch_data(name, i) {
    if (FIRST_LOAD) {
        render(name, i, 'blue');
    }
    query("/sla_quotes", make_renderer(name, i), undefined, undefined, name + "/default/" + PERIOD);
}

query('/customer_list', function(err, data){
    if (err){
        console.log(err);
        return;
    }
    Object.keys(data).sort().forEach(fetch_data);
    FIRST_LOAD = false;
});
