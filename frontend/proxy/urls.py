from django.conf.urls import url, include

from . import views

urlpatterns = [
    url(r'^$',                                                                          views.IndexView.as_view(),      name='index'),
    url(r'^dashboard/(?P<client>[a-zA-Z ]+)/$',                                         views.DashboardView.as_view(),  name='dashboard'),
    url(r'^dashboard/(?P<client>[a-zA-Z ]+)/(?P<month>[0-9\\-]+)$',                     views.DashboardView.as_view(),  name='dashboard'),
    url(r'^carousel',                                                                   views.CarouselView.as_view(),   name='carousel'),
    url(r'^api/(?P<item>[a-z_]+)/(?P<client>[a-zA-Z ]+)/default/(?P<month>[0-9\\-]+)$', views.Api.as_view(),            name='api')

    #url(r'^(?P<pk>[0-9]+)/$', views.DetailView.as_view(), name='detail'),
    #url(r'^(?P<quote_id>[0-9]+)/download$', views.django_file_download_view, name='download'),
]
