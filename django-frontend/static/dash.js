var sev_colors = [
    default_colors[7],
    default_colors[0],
    default_colors[2],
    default_colors[10]
];

console.log("dash");

(function(){
  console.log(PERIOD);
    for (var i = 0; i < 7; ++i){
        for (var j = 0; j < 5; ++j){
            [
                $('body > div.container-fluid > div:nth-child(' + i + ') > div:nth-child(' + j + ') > div > div.chart-notes'),
                $('body > div.container-fluid > div:nth-child(' + i + ') > div:nth-child(' + j + ') > div > div.chart-title')
            ].forEach(t => {
                t.text( t.text().replace(/PERIOD/g, PERIOD) );
            });
        }
    }

    $('#period-current').html(PERIOD);
    /*
    var pparts = PERIOD.split(/-/),
        year   = parseInt(pparts[0]),
        month  = parseInt(pparts[1]);

    function period_selection_formatter(sel, next_period){
        var period = next_period(),
            search = window.location.search;
        if (search.indexOf('period') < 0){
            search += '&period=' + period;
        }else{
            search = search.replace(/period=[^&]+/, 'period=' + period);
        }
        $(sel).attr('href', '/dash.html' + search);
    }

    period_selection_formatter('#period-prev', function(){
        var y = year;
        var m = month-1;
        if (m < 1){
            m = 12;
            y--;
        }
        return y + '-' + m;
    });

    period_selection_formatter('#period-next', function(){
        var y = year;
        var m = month+1;
        if (m > 12){
            m = 1;
            y++;
        }
        return y + '-' + m;
    });*/
})();

var chart06 = new Keen.Dataviz()
    .el('#chart-06')
    .title('WRs')
    .height(250)
    .colors([default_colors[0]])
    .type('metric')
    .prepare();

query('/wrs_created_count', render(chart06));

var chart07 = new Keen.Dataviz()
    .el('#chart-07')
    .title('uptime')
    .height(250)
    .chartOptions({suffix: '%'})
    .type('metric')
    .prepare();

function format_icinga_note(obj){
    if (obj.service.indexOf(obj.host) > -1){
        return obj.service;
    }else{
        return obj.host + '/' + obj.service;
    }
}

query('/availability', render(chart07, function(c, d){
    if (d.error || !d.result){
        d.result = 0;
        console.log('availability: ' + d.error);
        setTimeout(function(){ $('#chart-07 .keen-dataviz-metric-value').text('N/A'); }, 10);
        return;
    }
    if (d.host && d.service){
        $('#avail-notes').text(format_icinga_note(d));
    }
    if (d.result < 99.5){
        c.colors([default_colors[1]]);
    }else if (d.result < 99.9){
        c.colors([default_colors[2]]);
    }else{
        c.colors([default_colors[7]]);
    }
}));

var chart09 = new Keen.Dataviz()
    .el('#chart-09')
    .title('disk used')
    .height(250)
    .colors([default_colors[5]])
    .type('metric')
    .prepare();

// TODO: for clients with storage limits defined by contract, make this a guage chart instead.
query('/storage', render(chart09, function(chart, data){
    if (data.error || !data.result){
        data.result = 0;
        console.log('storage: ' + data.error);
        setTimeout(function(){ $('#chart-09 .keen-dataviz-metric-value').text('N/A'); }, 10);
        return;
    }
    if (data.host && data.service){
        $('#storage-notes').text(format_icinga_note(data) + ' (' + data.result + 'MB)');
    }
    var GB = 1000,
        TB = 1000*GB;
    if (data.result < GB){
        chart.chartOptions({suffix: 'MB'})
    }else if (data.result < TB){
        data.result = Math.round(data.result/GB*10)/10;
        chart.chartOptions({suffix: 'GB'})
    }else{
        data.result = Math.round(data.result/TB*10)/10;
        chart.chartOptions({suffix: 'TB'})
    }
}));

var chart10 = new Keen.Dataviz()
    .el('#chart-10')
    .colors([default_colors[9]])
    .title('user accounts')
    .height(250)
    .type('metric')
    .prepare();

// TODO: for clients with user limits defined by contract, e.g. Totara, make this a guage chart instead.
query('/users', render(chart10, function(chart, data){
    if (data.error || !data.result){
        data.result = 0;
        console.log('users: ' + data.error);
        setTimeout(function(){ $('#chart-10 .keen-dataviz-metric-value').text('N/A'); }, 10);
        return;
    }
}));

query('/customer', function(err, data){
    if (!err){
        $('#cust-name').text(data.system.name);
        $('#period-current').attr('href', 'https://wrms.catalyst.net.nz/requestlist.php?org_code=' + data.org.id);
    }
});

var donut_options = {
    donut: {
        label: {
            format: function(value, ratio, id){ return value + ' hours'; }
        }
    },
    chartArea: {
        height: "85%",
        left: "5%",
        top: "5%",
        width: "100%"
    }
}

function handle_empty_data(chart, data){
    if (data.result.length === 1 && data.result[0].wr === 'None'){
        chart.type('message')
            .message('No data');
        data.__skip_render = true;
    }
}

var chart02 = new Keen.Dataviz()
    .el('#chart-02')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

query('/sla_quotes', render(chart02, handle_empty_data));

var chart14 = new Keen.Dataviz()
    .el('#chart-14')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

query('/sla_unquoted', render(chart14, handle_empty_data));

var chart03 = new Keen.Dataviz()
    .el('#chart-03')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions(donut_options)
    .prepare();

query('/additional_quotes', render(chart03, handle_empty_data));

google.charts.load('current', {packages: ['corechart', 'bar', 'table', 'line']});
google.charts.setOnLoadCallback(draw_custom_charts);

function draw_custom_charts(){
    var common_options = {
        titlePosition: 'none',
        legend: {position: 'none'},
        chartArea: {height: 200, left: '10%', width: '90%' },
        height: 250,
        orientation: 'horizontal',
        annotations: {
            alwaysOutside: true,
            textStyle: {
                fontSize: 12,
                auraColor: 'none',
                color: '#555'
            },
            boxStyle: {
                stroke: '#ccc',
                strokeWidth: 1,
                gradient: {
                    color1: '#f3e5f5',
                    color2: '#f3e5f5',
                    x1: '0%', y1: '0%',
                    x2: '100%', y2: '100%'
                }
            }
        },
        hAxis: {
            title: 'Category'
        },
        vAxis: {
            title: 'Number of WRs',
            minValue: 0
        },
        axisTitlesPosition: 'none'
    };

    query('/wrs_over_time', function(err, data){
        if (err){
            console.log('wrs_over_time: ' + err);
            return;
        }

        var o = JSON.parse(JSON.stringify(common_options));
        o.legend.position = 'right';
        o.curveType = 'function';
        o.colors = sev_colors;
        o.vAxis.viewWindow = {min:0};
        o.chartArea = {
            top: '5%', height: 200, left: '5%', width: '80%'
        };
        o.height = 250;

        var chart11 = new google.visualization.LineChart(document.getElementById('chart-11'));

        chart11.draw(google.visualization.arrayToDataTable(data), o);
    });

    query('/sla_hours', function(err, data){
        if (err){
            console.log('sla_hours: ' + err);
            return;
        }

        var o = JSON.parse(JSON.stringify(common_options));
        o.orientation = 'vertical';
        o.chartArea = {height: 200, left: '25%', width: '75%' };
        o.__a = o.hAxis;
        o.hAxis = o.vAxis;
        o.vAxis = o.__a;

        document.getElementById('chart-01-notes').innerText = 'Monthly SLA budget: ' + data.budget + ' hours';

        // Target format is
        //  ['Category', 'Hours', {role: 'style'}],
        //  ['$column_heading', $value, $color],
        //  [...]
        data.result.forEach((row, i) => { row.push(default_colors[i]) });
        data.result.unshift(['Category', 'Hours', {role: 'style'}]);

        var chart01 = new google.visualization.BarChart(document.getElementById('chart-01'));

        chart01.draw(google.visualization.arrayToDataTable(data.result), o);
    });

    query('/severity', function(err, data){
        if (err){
            console.log('severity: ' + err);
            return;
        }
        data.forEach((row, i) => { row.push(sev_colors[i]) });
        data.unshift(['Category', 'Number of WRs', {role: 'style'}]);

        var chart04 = new google.visualization.BarChart(document.getElementById('chart-04'));

        chart04.draw(google.visualization.arrayToDataTable(data), common_options);
    });

    query('/response_times', function(err, data){
        if (err){
            console.log('response_times: ' + err);
            return;
        }
        if (data.result.length < 2){
            (new Keen.Dataviz())
                .el('#chart-08')
                .type('message')
                .message('No data');
            return;
        }
        data.result.forEach((row, i) => { row.push(sev_colors[i]) });
        data.result.unshift(['Category', '95% response time', {role: 'style'}]);

        var chart08 = new google.visualization.BarChart(document.getElementById('chart-08'));

        chart08.draw(google.visualization.arrayToDataTable(data.result), common_options);
    });

    query('/statuses', function(err, data){
        if (err){
            console.log('statuses: ' + err);
            return;
        }
        if (data.length < 1){
            console.log('statuses: no data');
            return;
        }
        var o = JSON.parse(JSON.stringify(common_options));
        o.chartArea.height = 150;

        data.forEach((row, i) => { row.push(default_colors[0]) });
        data.unshift(['Category', 'Number of WRs', {role: 'style'}]);

        var chart05 = new google.visualization.BarChart(document.getElementById('chart-05'));

        chart05.draw(google.visualization.arrayToDataTable(data), o);
    });

    query('/wr_list', function(err, data){
        if (err){
            console.log('wr_list: ' + err);
            return;
        }
        if (data.length < 1){
            (new Keen.Dataviz())
                .el('#chart-13')
                .type('message')
                .message('No data');
            return;
        }
        var table = new google.visualization.DataTable();
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('string', 'Status');
        table.addColumn('string', 'Urgency');
        table.addRows(
            data.map(function(row){
                return [
                    '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '">' + row.request_id + '</a>',
                    row.brief,
                    row.status,
                    row.urgency
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-13'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    });

    query('/deployments', function(err, data){
        if (err){
            console.log('deployments: ' + err);
            return;
        }

        var formatted_data = data.map(function(row){
            var arr = row.description.split('\n');
            var desc = arr.filter(function(element){
                return element[0] === '*';
            }).join('<br>');

            return [
                '<a href="https://wrms.catalyst.net.nz/' + row.request_id + '">' + row.request_id + '</a>',
                row.brief,
                desc
            ];
        });

        if (formatted_data.length < 1){
            (new Keen.Dataviz())
                .el('#chart-12')
                .type('message')
                .height(250)
                .message('No deployments');
            return;
        }

        var table = new google.visualization.DataTable();
        table.addColumn('string', 'WR#');
        table.addColumn('string', 'Brief');
        table.addColumn('string', 'Description');
        table.addRows(formatted_data);

        var viz = new google.visualization.Table(document.getElementById('chart-12'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    });

} // google charts

var gophers = [
    'ASHLEY_STEVE.png',
    'BELGIUM.png',
    'BUFFALO_CASTS.png',
    'CouchPotatoGopher.png',
    'COWBOY_GOPHER.png',
    'DRAWING_GOPHER.png',
    'GIRL_GOPHER.png',
    'GO_BUFFALO.png',
    'GO_LEARN.png',
    'GOPHERCON.png',
    'GOPHER_DENVER.png',
    'GOPHER_INCLUSION.png',
    'GOPHER_LAPTOP.png',
    'GOPHER_MIC_DROP_WITH_BACKGROUND.png',
    'GOPHER_SAFARI.png',
    'GopherSpaceCommunity.png',
    'GopherSpaceMentor.png',
    'LazyGopher.png',
    'LION_GOPHER.png',
    'MovingGopher.png',
    'NERDY.png',
    'pride_circle.png',
    'SPACEGIRL_GOPHER.png',
    'This_is_Fine_Gopher.png',
    'Unicorn_Gopher.png'
];

document.getElementById('gopher').src = '/static/img/gophers/' + gophers[Math.round(Math.random()*(gophers.length-1))];
