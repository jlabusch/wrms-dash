\
URI_EXT = ORG + '/' + 1661 + '/' + PERIOD;

query('/customer_list', function(err, data){
    if (err){
        console.log(err);
        return;
    }
    Object.keys(data).sort().forEach(function(name, i){
        console.log(name);
        $('.chart-wrapper:eq(' + i + ')').html(
            '<a href="/dash.html?org=' + name + '"><div class="index-tile">' + name + '</div></a>'
        );
    });
});
