from django.urls import path
from .views import RegisterView, LoginView,ZohoConnectView,ZohoCallbackView,ZohoInvoicesView,InvoiceListView,InvoiceUpdateView,CreateInvoiceView,InvoiceDeleteView,ZohoSyncItemsView,ZohoSyncContactsView
from .views import MenuItemView,CustomerListView,CustomerUpdateView,DeliveryItemView,DeliveryOrderView,KitchenPrepView,GenerateInvoiceView,BulkSaveDeliveryView
from .views import SleeveInventoryView,ResetSleeveInventoryView,MarkDeliveredView
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
    path('invoices/create/', CreateInvoiceView.as_view()),
    path('invoices/<int:id>/', InvoiceUpdateView.as_view()),
    path('invoices/<int:id>/delete/', InvoiceDeleteView.as_view()),
    path('zoho/items/', ZohoSyncItemsView.as_view()),
    path('zoho/contacts/', ZohoSyncContactsView.as_view()),
    path('menu-items/', MenuItemView.as_view()),
    path('customers/', CustomerListView.as_view()),
    path('customers/<int:id>/', CustomerUpdateView.as_view()),
    path('delivery/', DeliveryOrderView.as_view()),
    path('delivery/<str:date>/', DeliveryOrderView.as_view()),
    path('delivery/<int:order_id>/item/', DeliveryItemView.as_view()),
    path('delivery/<int:order_id>/save/', BulkSaveDeliveryView.as_view()),
    path('delivery/<int:order_id>/kitchen-prep/', KitchenPrepView.as_view()),
    path('delivery/<int:order_id>/generate-invoice/<int:customer_id>/', GenerateInvoiceView.as_view()),
    path('delivery/<int:order_id>/deliver/', MarkDeliveredView.as_view()),
    path('inventory/', SleeveInventoryView.as_view()),
    path('inventory/reset/', ResetSleeveInventoryView.as_view()),
]