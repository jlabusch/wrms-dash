from django.conf.urls import url, include

from . import views

urlpatterns = [
    url(r'^$',                                                                              views.IndexView.as_view(),      name='index'),
    url(r'^dashboard/(?P<client>[_a-z0-9A-Z ]+)/$',                                         views.DashboardView.as_view(),  name='dashboard'),
    url(r'^dashboard/(?P<client>[_a-z0-9A-Z ]+)/(?P<systems>[a-z0-9,]+)/(?P<month>[0-9\\-]*)$',views.DashboardView.as_view(),  name='dashboard'),
    url(r'^carousel',                                                                       views.CarouselView.as_view(),   name='carousel'),
    url(r'^omnitool',                                                                       views.OmnitoolView.as_view(),   name='omnitool'),
    url(r'^api/(?P<item>[a-z_]+)/(?P<client>[_a-z0-9A-Z ]+)/(?P<systems>[a-z0-9,]+)/(?P<month>[0-9\\-]+)$', views.Api.as_view(), name='api')
]
