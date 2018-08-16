URI_EXT = '__vendor/default/2017-7';

var tile_exists = {};

function mkuri(org){
    return org.org_id + "/" + org.systems.join(',') + "/" + PERIOD;
}

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
        }

        const org = {name: name, org_id: data[name].org_id, systems: data[name].systems};

        if (!tile_exists[name]){
            draw_tile(org, i, 'blue');
            tile_exists[name] = true;
        }
        query(
            "/sla_hours",
            handle_hours(org, i, after_fetches),
            undefined,
            0,
            mkuri(org)
        );
    });
});

function handle_hours(org, i, next){
    return function(qerr, data) {
        if (qerr){
            console.log('sla_quotes: ' + JSON.stringify(qerr));
            next();
            return;
        }
        if (!data.budget){
            console.log(org.name + ' has no budget, not applying color');
            next();
            return;
        }
        if (!data.result || data.result.length < 3){
            console.log(org.name + ' has invalid "result" array for client data, not applying color');
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
            handle_count(org, i, color, next),
            undefined,
            0,
            mkuri(org)
        );
    };
}

function handle_count(org, i, color, next){
    return function(qerr, data) {
        if (qerr){
            console.log('wrs_created_count: ' + JSON.stringify(qerr));
            next();
            return;
        }
        var count = '';
        if (typeof(data.result) === 'number'){
            console.log(org.name + ': ' + data.result);
            count = data.result;
        }
        next(org, i, color, count);
    }
}

function draw_tile(org, i, color, count){
    if (count === undefined){
        count = '';
    }
    $('.chart-wrapper:eq(' + i + ')').html(
        '<a href="/dashboard/' + org.org_id + '/' + org.systems + '/">' +
            '<div class="index-tile ' + color + '">' +
                '<span class="tile-count">' + count + '</span>' +
                '<span class="tile-name">' + org.name.replace(/ SLA /, ' ').replace(/\d\d\d\d\s?-\s?/, '') + '</span>' +
            '</div>' +
        '</a>'
    );
}

