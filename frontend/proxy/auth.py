def is_member(user):
    return user.groups.filter(name='Member').exists(
# Make a group for unicef and use that to choose which orgs they can view)
# https://docs.djangoproject.com/en/1.11/topics/auth/default/#module-django.contrib.auth.views
# https://docs.djangoproject.com/en/1.11/topics/auth/default/#django.contrib.auth.decorators.login_required
