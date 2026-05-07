from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User
from .models import ZohoToken
from .models import MenuItem, Ingredient, MenuIngredient, DeliveryOrder, DeliveryItem, CustomDeliveryEntry, SleeveInventory
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

from .models import Customer, Invoice, Payment, GeneratedInvoice

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

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('product_code', 'name', 'is_active')
    search_fields = ('name', 'product_code')
    list_filter = ('is_active',)

@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit', 'created_at')
    search_fields = ('name',)

@admin.register(MenuIngredient)
class MenuIngredientAdmin(admin.ModelAdmin):
    list_display = ('menu_item', 'ingredient', 'amount_per_portion')
    search_fields = ('menu_item__name', 'ingredient__name')

@admin.register(DeliveryOrder)
class DeliveryOrderAdmin(admin.ModelAdmin):
    list_display = ('delivery_date', 'use_by_date', 'created_by', 'created_at')
    search_fields = ('delivery_date',)

@admin.register(CustomDeliveryEntry)
class CustomDeliveryEntryAdmin(admin.ModelAdmin):
    list_display = ('name', 'delivery_order')
    search_fields = ('name',)

@admin.register(DeliveryItem)
class DeliveryItemAdmin(admin.ModelAdmin):
    list_display = ('delivery_order', 'customer', 'custom_entry', 'menu_item', 'quantity')
    search_fields = ('customer__name', 'custom_entry__name', 'menu_item__name')

@admin.register(GeneratedInvoice)
class GeneratedInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'customer', 'delivery_order', 'created_at')
    search_fields = ('invoice_number', 'customer__name')

@admin.register(SleeveInventory)
class SleeveInventoryAdmin(admin.ModelAdmin):
    list_display = ('menu_item', 'quantity', 'updated_at')
    search_fields = ('menu_item__name', 'menu_item__product_code')


