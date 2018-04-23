URI_EXT = '__vendor/default/2017-7';

var FIRST_LOAD = true;

function draw_tile(name, i, color, count){
    if (count === undefined){
        count = '';
    }
    $('.chart-wrapper:eq(' + i + ')').html(
        '<a href="/dashboard/' + name + '/">' +
            '<div class="index-tile ' + color + '">' +
                '<span class="tile-count">' + count + '</span>' +
                '<span class="tile-name">' + name + '</span>' +
            '</div>' +
        '</a>'
    );
}

function handle_count(name, i, color, next){
    return function(qerr, data) {
        if (qerr){
            console.log('wrs_created_count: ' + JSON.stringify(qerr));
            next();
            return;
        }
        var count = '';
        if (typeof(data.result) === 'number'){
            console.log(name + ': ' + data.result);
            count = data.result;
        }
        next(name, i, color, count);
    }
}

function handle_hours(name, i, next){
    return function(qerr, data) {
        if (qerr){
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

        query(
            "/wrs_created_count",
            handle_count(name, i, color, next),
            undefined,
            0,
            name + "/default/" + PERIOD
        );
    };
}

function fetch_quotes_from_queue(head, rest){
    if (!head){
        return;
    }
    function after_fetches(){
        if (arguments[0]){
            draw_tile.apply(this, arguments);
        }
        fetch_quotes_from_queue(rest.shift(), rest);
    }
    query(
        "/sla_hours",
        handle_hours(head.name, head.index, after_fetches),
        undefined,
        0,
        head.name + "/default/" + PERIOD
    );
}

var first_loads = {};

query('/customer_list', function(err, data){
    if (err){
        console.log('customer_list: ' + err);
        return;
    }

    Object.keys(data).sort().filter(function(n){ return n !== '__vendor' }).forEach((name, i) => {
        function after_fetches(){
            if (arguments[0]){
                draw_tile.apply(this, arguments);
            }
            fetch_quotes_from_queue(rest.shift(), rest);
        }
        if (!first_loads[name]){
            draw_tile(name, i, 'blue');
            first_loads[name] = true;
        }
        query(
            "/sla_hours",
            handle_hours(name, i, after_fetches),
            undefined,
            0,
            name + "/default/" + PERIOD
        );
    });
});
