URI_EXT = 'Catalyst%20EU/default/2017-7';

var FIRST_LOAD = true;

function render(name, i, color){
    $('.chart-wrapper:eq(' + i + ')').html(
        '<a href="/dashboard/' + name + '/"><div class="index-tile ' + color + '">' + name + '</div></a>'
    );
}

function handle_hours(name, i, next){
    return function(cerr, data) {
        if (cerr){
            console.log('sla_quotes: ' + JSON.stringify(qerr));
            next();
            return;
        }
        if (!data.budget){
            console.log(name + ' has no budget, not applying color');
            next();
            return;
        }
        if (!data.result || data.result.length < 3){
            console.log(name + ' has invalid "result" array for client data, not applying color');
            next();
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

        next(name, i, color);
    };
}

function fetch_hours(name, i, next){
    return function(qerr) {
        if (qerr){
            console.log('sla_quotes: ' + JSON.stringify(qerr));
            next();
            return;
        }
        query(
            "/sla_hours",
            handle_hours(name, i, next),
            undefined,
            undefined,
            name + "/default/" + PERIOD
        );
    }
}

function fetch_quotes_from_queue(head, rest){
    if (!head){
        return;
    }
    function after_fetches(name, i, color){
        if (name){
            render(name, i, color);
        }
        fetch_quotes_from_queue(rest.shift(), rest);
    }
    query(
        '/sla_quotes',
        fetch_hours(head.name, head.index, after_fetches),
        undefined,
        undefined,
        head.uri
    );
}

var query_list = [];

function build_queue(name, i) {
    if (FIRST_LOAD) {
        render(name, i, 'blue');
    }
    query_list.push({
        name: name,
        index: i,
        uri: name + '/default/' + PERIOD
    });
}

query('/customer_list', function(err, data){
    if (err){
        console.log('customer_list: ' + err);
        return;
    }
    query_list = [];
    Object.keys(data).sort().forEach(build_queue);
    FIRST_LOAD = false;
    fetch_quotes_from_queue(query_list.shift(), query_list);
});
