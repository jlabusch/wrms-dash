from django.conf.urls import url, include

from . import views

urlpatterns = [
    url(r'^$', views.IndexView.as_view(), name='index'),
    url(r'^dashboard/(?P<client>[a-zA-Z ]+)/$', views.DashboardView.as_view(), name='dashboard'),
    url(r'^dashboard/(?P<client>[a-zA-Z ]+)/(?P<month>[0-9\\-]+)$', views.DashboardView.as_view(), name='dashboard'),
    #url(r'^api$', views.Api.as_view(), name='dashboard')
    url(r'^api/(?P<item>[a-z_]+)/(?P<client>[a-zA-Z ]+)/default/(?P<month>[0-9\\-]+)$', views.Api.as_view(), name='api')

    #http://192.168.90.56:8004/wrs_created_count/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/availability/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/storage/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/users/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/customer/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/sla_quotes/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/sla_unquoted/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/additional_quotes/HLA Kaya/default/2017-7

    #http://192.168.90.56:8004/wrs_over_time/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/sla_hours/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/severity/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/response_times/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/statuses/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/wr_list/HLA Kaya/default/2017-7
    #http://192.168.90.56:8004/deployments/HLA Kaya/default/2017-7


    #url(r'^(?P<pk>[0-9]+)/$', views.DetailView.as_view(), name='detail'),
    #url(r'^(?P<quote_id>[0-9]+)/download$', views.django_file_download_view, name='download'),
]
