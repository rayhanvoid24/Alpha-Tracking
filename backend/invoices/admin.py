from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User
from .models import ZohoToken
# Register your models here.
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'full_name', 'role', 'is_approved')
    list_filter = ('role', 'is_approved')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('full_name', 'role')}),
        ('Permissions', {'fields': ('is_approved', 'is_active', 'is_staff', 'is_superuser')}),
    )
    ordering = ('email',)
    search_fields = ('email', 'full_name')

from .models import Customer, Invoice, Payment

# Register Customer model with admin panel
@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'account', 'BSB')
    search_fields = ('name', 'email', 'account')

# Register Invoice model with admin panel
@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'customer', 'date', 'amount', 'due_date', 'status')
    list_filter = ('status',)
    search_fields = ('invoice_number',)

# Register Payment model with admin panel
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('customer', 'invoice', 'amount_paid', 'payment_date', 'status')
    list_filter = ('status',)

@admin.register(ZohoToken)
class ZohoTokenAdmin(admin.ModelAdmin):
    list_display = ('organization_id', 'created_at', 'updated_at')

