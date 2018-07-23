from django.conf.urls import url, include

from . import views

# TODO: to support multiple active contracts per client, the "dashboard" and "api" URLs need
# to match (?P<systems>[0-9,]+) between <client> and <month>.
urlpatterns = [
    url(r'^$',                                                                              views.IndexView.as_view(),      name='index'),
    url(r'^dashboard/(?P<client>[_a-z0-9A-Z ]+)/$',                                         views.DashboardView.as_view(),  name='dashboard'),
    url(r'^dashboard/(?P<client>[_a-z0-9A-Z ]+)/(?P<month>[0-9\\-]+)$',                     views.DashboardView.as_view(),  name='dashboard'),
    url(r'^carousel',                                                                       views.CarouselView.as_view(),   name='carousel'),
    url(r'^omnitool',                                                                       views.OmnitoolView.as_view(),   name='omnitool'),
    url(r'^api/(?P<item>[a-z_]+)/(?P<client>[_a-z0-9A-Z ]+)/default/(?P<month>[0-9\\-]+)$', views.Api.as_view(),            name='api')

    #url(r'^(?P<pk>[0-9]+)/$', views.DetailView.as_view(), name='detail'),
    #url(r'^(?P<quote_id>[0-9]+)/download$', views.django_file_download_view, name='download'),
]
