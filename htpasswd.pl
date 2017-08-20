my $c = "-c";
while (<>){
    my ($u,$p) = m/^.*?"([^"\/]+)\/([^"]+).*$/;
    if ($u){
        system "htpasswd $c -b ./.htpasswd '$u' '$p'";
    }
    $c = "";
}

