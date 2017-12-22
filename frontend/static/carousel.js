(function(){
    var uri_list = [],
        PREFETCH_DELAY = 15, // gap between showing one dash and fetching the next
        SHOW_DELAY = 30,    // time between prefetch starting and page slide starting
        ANIM_DELAY = 1.5;     // time from page slide effect starting in one direction to the bounce back

    function inc(n){ return (n+1) % uri_list.length; }

    function dash_uri(customer){ return customer === '/' ? '/' : '/dashboard/' + customer + '/?nohelp'; }

    function anim_part_2(n){
        console.log('anim_part_2(' + uri_list[n] + ')');

        $('#content').removeClass('page-moveToRight').addClass('page-moveFromRight');

        document.getElementById('visible-frame').src = dash_uri(uri_list[n]);

        setTimeout(function(){
            // tidying up
            $('#content').removeClass('page-moveFromRight');
        }, ANIM_DELAY*1000);

        setTimeout(function(){
            prefetch(inc(n))
        }, PREFETCH_DELAY*1000);
    }

    function anim_part_1(n){
        console.log('anim_part_1(' + uri_list[n] + ')');

        $('#content').addClass('page-moveToRight');

        setTimeout(function(){ anim_part_2(n) }, ANIM_DELAY*1000);
    }

    function prefetch(n){
        console.log('prefetch(' + uri_list[n] + ')');
        document.getElementById('prefetch-frame').src = dash_uri(uri_list[n]);

        $('#cover').html('<h1>' + uri_list[n].replace('%20', ' ') + '</h1>');
        setTimeout(function(){ anim_part_1(n) }, SHOW_DELAY*1000);
    }

    query(
        '/customer_list',
        function(err, data){
            if (err){
                console.log('customer_list: ' + err);
                return;
            }
            uri_list = Object.keys(data).sort();
            uri_list.push('/');

            prefetch(0);
        },
        undefined,
        0
    );

    var resizing = false;

    function do_resize(){
        console.log('resizing at ' + (new Date()).getTime());
        document.getElementById('visible-frame').width = window.innerWidth;
        document.getElementById('visible-frame').height = window.innerHeight;

        resizing = false;
    }

    window.addEventListener('resize', function(){
        if (!resizing){
            setTimeout(do_resize, 66);
        }
        resizing = true;
    });
})();
