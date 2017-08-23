import datetime

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User, Group
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views import generic, View
from django.shortcuts import redirect

import requests


MANGO_SERVER = "http://mango.btn.catalyst-eu.net:8004"


@method_decorator(login_required, name='dispatch')
class IndexView(generic.TemplateView):
    template_name = 'index.html'


    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_superuser:
            context["groups"] = Group.objects.exclude(id__in=self.request.user.groups.all().values_list('id', flat=True))
        else:
            context["groups"] = self.request.user.groups.all()
        return context
        #return redirect(DashboardView, client = self.dispatch.client, month = self.dispatch.month)

    def dispatch(self, request):
        if not self.request.user.is_superuser:
            client = self.request.user.groups.all()[0]
            return redirect ('proxy:dashboard', client=client)
        else:
            return super().dispatch(request)



@method_decorator(login_required, name='dispatch')
class DashboardView(generic.TemplateView):
    template_name = 'dashboard.html'

    def dispatch(self, request, client, month=None):
        if month is None:
            month = datetime.datetime.now().strftime("%Y-%m")
        month_dt = datetime.datetime.strptime(month, "%Y-%m")
        min_dt = datetime.datetime.strptime("2017-7", "%Y-%m") #min date to view.
        if month_dt < min_dt:
            return redirect('proxy:dashboard', client=client)
        if not request.user.is_superuser: #If not admin, cannot view any months earlier than July 2017. TODO: fix this properly with a database for the client SLA dates instead of hard coding
            month = max(month_dt, min_dt).strftime("%Y-%m")

        if month == "2017-07": #TODO: remove hard coding
            self.min_reached = True
        else:
            self.min_reached = False
        self.month = month
        self.client = client
        if not is_member(request.user, client) and not request.user.is_superuser:
            raise PermissionDenied()
        else:
            return super().dispatch(request, client)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["client"] = self.client
        context["month"] = self.month
        context["prev_month"] = get_prev_month(self.month)
        context["next_month"] = get_next_month(self.month)
        context["min_reached"] = self.min_reached
        print(context)
        return context


@method_decorator(login_required, name='dispatch')
class Api(generic.TemplateView):
    def get(self, request, item, client, month):
        month_dt = datetime.datetime.strptime(month, "%Y-%m")
        min_dt = datetime.datetime.strptime("2017-7", "%Y-%m") #min date to view.
        if not request.user.is_superuser: #If not admin, cannot view any months earlier than July 2017. TODO: fix this properly with a database for the client SLA dates instead of hard coding
            month = max(month_dt, min_dt).strftime("%Y-%m")
        if not is_member(request.user, client) and not request.user.is_superuser:
            raise PermissionDenied()

        url = "{}/{}/{}/default/{}".format(MANGO_SERVER, item, client, month)
        jsondata = requests.get(url).text
        return HttpResponse(jsondata, content_type='application/json')

def is_member(user, group):
    return user.groups.filter(name=group).exists()


def get_prev_month(month):
    y, m = month.split("-")
    m = int(m) - 1
    y = int(y)
    if m < 1:
        m = 12
        y -= 1
    return "{}-{}".format(y, m)


def get_next_month(month):
    y, m = month.split("-")
    m = int(m) + 1
    y = int(y)
    if m > 12:
        m = 1
        y += 1
    return "{}-{}".format(y, m)
