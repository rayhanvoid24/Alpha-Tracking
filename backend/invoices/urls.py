from django.urls import path
from .views import RegisterView, LoginView,ZohoConnectView,ZohoCallbackView,ZohoInvoicesView,InvoiceListView,InvoiceUpdateView,CreateInvoiceView,InvoiceDeleteView

# All auth related URLs
# Each path connects a URL to a view

urlpatterns = [
    # POST /api/auth/register — creates a new staff account
    path('auth/register/', RegisterView.as_view()),
    
    # POST /api/auth/login — logs in and returns JWT tokens
    path('auth/login/', LoginView.as_view()),
    # Get Endpoints for zhoho
    path('zoho/callback/',ZohoCallbackView.as_view()),
    path('zoho/connect/',ZohoConnectView.as_view()),
    path('zoho/invoices/',ZohoInvoicesView.as_view()),
    path('invoices/', InvoiceListView.as_view()),
    path('invoices/<int:id>/', InvoiceUpdateView.as_view()),
    path('invoices/create/', CreateInvoiceView.as_view()),
    path('invoices/<int:id>/delete/', InvoiceDeleteView.as_view()),



]