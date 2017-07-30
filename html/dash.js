var sev_colors = [
    default_colors[7],
    default_colors[0],
    default_colors[2],
    default_colors[10]
];


(function(){
    for (var i = 0; i < 5; ++i){
        for (var j = 0; j < 5; ++j){
            [
                $('body > div.container-fluid > div:nth-child(' + i + ') > div:nth-child(' + j + ') > div > div.chart-notes'),
                $('body > div.container-fluid > div:nth-child(' + i + ') > div:nth-child(' + j + ') > div > div.chart-title')
            ].forEach(t => {
                t.text( t.text().replace(/PERIOD/g, PERIOD) );
            });
        }
    }

    var pparts = PERIOD.split(/-/),
        year   = parseInt(pparts[0]),
        month  = parseInt(pparts[1]);

    (function(){
        var y = year;
        var m = month-1;
        if (m < 1){
            m = 12;
            y--;
        }
        var period = y + '-' + m,
            search = window.location.search;
        if (search.indexOf('period') < 0){
            search += '&period=' + period;
        }else{
            search = search.replace(/period=[^&]+/, 'period=' + period);
        }
        $('#period-prev')
            .attr('href', '/dash.html' + search)
            .text('(<< ' + period + ')');
    })();

    (function(){
        var y = year;
        var m = month+1;
        if (m > 12){
            m = 1;
            y++;
        }
        var period = y + '-' + m,
            search = window.location.search;
        if (search.indexOf('period') < 0){
            search += '&period=' + period;
        }else{
            search = search.replace(/period=[^&]+/, 'period=' + period);
        }
        $('#period-next')
            .attr('href', '/dash.html' + search)
            .text('(' + period + ' >>)');
    })();
})();

var chart06 = new Keen.Dataviz()
    .el('#chart-06')
    .title('WRs this period')
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
        console.log(d.error);
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
        console.log(data.error);
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
query('/users', render(chart10));

query('/customer', function(err, data){
    if (!err){
        $('#cust-name')
            .text(data.org.name)
            .attr('href', 'https://wrms.catalyst.net.nz/requestlist.php?org_code=' + data.org.id);
        $('#cust-system')
            .text(data.system.name)
            .attr('href', 'https://wrms.catalyst.net.nz/requestlist.php?org_code=' + data.org.id);
    }
});

var chart02 = new Keen.Dataviz()
    .el('#chart-02')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions({
        donut: {
            label: {
                format: function(value, ratio, id){ return value + ' hours'; }
            }
        },
        legend:{ position: 'none' },
        chartArea: {
            height: "85%",
            left: "5%",
            top: "5%",
            width: "100%"
        }
    })
    .prepare();

query('/sla_quotes', render(chart02));

var chart03 = new Keen.Dataviz()
    .el('#chart-03')
    .colors(default_colors)
    .height(250)
    .type('donut')
    .chartOptions({
        donut: {
            label: {
                format: function(value, ratio, id){ return value + ' hours'; }
            }
        },
        legend:{ position: 'none' },
        chartArea: {
            height: "85%",
            left: "5%",
            top: "5%",
            width: "100%"
        }
    })
    .prepare();

query('/additional_quotes', render(chart03));

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

        console.log(JSON.stringify(data, null, 2));

        var o = JSON.parse(JSON.stringify(common_options));
        o.legend.position = 'right';
        o.curveType = 'function';
        o.colors = sev_colors;
        o.vAxis.viewWindow = {min:0};
        o.chartArea = {
            top: '5%', height: 200, left: '5%', width: '85%'
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
            console.log('severity: ' + err);
            return;
        }
        if (data.result.length < 2){
            console.log('severity: no data');
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
            console.log('wr_list: no data');
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
                    'WR ' + row.request_id,
                    row.brief,
                    row.status,
                    row.urgency
                ];
            })
        );
        var viz = new google.visualization.Table(document.getElementById('chart-13'));
        viz.draw(table, {allowHtml: true, showRowNumber: false, width: '100%', height: '250'});
    });
} // google charts

var gophers = [
    'COWBOY_GOPHER.png',
    'GIRL_GOPHER.png',
    'GO_BUFFALO.png',
    'GOPHERCON.png',
    'GOPHER_DENVER.png',
    'GOPHER_SAFARI.png',
    'LION_GOPHER.png',
    // 'ZERO_FUCKS.png',
    'STAR_TREK_GOPHER.png'
];

document.getElementById('gopher').src = './' + gophers[Math.round(Math.random()*(gophers.length-1))];

