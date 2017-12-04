URI_EXT = 'Catalyst%20EU/default/2017-7';
FIRST_LOAD = true;

function fetch_data(name, i) {
    if (FIRST_LOAD) {
        $('.chart-wrapper:eq(' + i + ')').html(
            '<a href="/dashboard/' + name + '/"><div class="index-tile blue">' + name + '</div></a>'
        );
    }
    console.log(name);
    query("/sla_quotes",
        function(xx, xxx) {
            query("/sla_hours",
                function(err_client, client) {
                    var budget = client["budget"];
                    var quoted = client["result"][0][1];
                    var unquoted = client["result"][1][1];
                    var total = quoted + unquoted;
                    var color = "red";
                    if (total < budget * 0.75) {
                        color = "green";
                    } else if (total < budget) {
                        color = "yellow";
                    }

                    $('.chart-wrapper:eq(' + i + ')').html(
                        '<a href="/dashboard/' + name + '/"><div class="index-tile ' + color + '">' + name + '</div></a>'
                    );
                },
                undefined,
                undefined,
                name + "/default/" + PERIOD);
        },
        undefined,
        undefined,
        name + "/default/" + PERIOD);
}

query('/customer_list', function(err, data){
    if (err){
        console.log(err);
        return;
    }
    Object.keys(data).sort().forEach(fetch_data);
});
