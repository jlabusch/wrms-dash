
URI_EXT = 'Catalyst%20EU/default/2017-7';

query('/customer_list', function(err, data){
    if (err){
        console.log(err);
        return;
    }
    Object.keys(data).sort().forEach(function(name, i){
        console.log(name);
        $('.chart-wrapper:eq(' + i + ')').html(
            '<a href="/dashboard/' + name + '/"><div class="index-tile">' + name + '</div></a>'
        );
    });
});

