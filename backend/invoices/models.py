from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
# Create your models here.
class UserManager(BaseUserManager):
    def create_user(self,email,password = None, **extra_fields):
        if not email:
            raise ValueError("email is required")
        email = self.normalize_email(email)
        user = self.model(email = email, **extra_fields)
        user.set_password(password)
        user.save(using = self._db)
        return user

    def create_superuser(self,email, password = None, **extra_feilds):
        extra_feilds.setdefault("is_staff", True)
        extra_feilds.setdefault("is_superuser", True)
        extra_feilds.setdefault("is_approved", True)
        return self.create_user(email,password,**extra_feilds)
    

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('staff', 'Staff'),
    ]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=100)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='staff')
    is_approved = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email
    

class Customer(models.Model):
    name = models.CharField( max_length= 100)
    address = models.CharField(max_length= 200,blank = True, null= True)
    email = models.EmailField(blank = True, null= True)
    account = models.CharField(max_length= 10, blank= True, null= True)
    BSB = models.CharField(max_length= 6, blank= True, null= True)
    created_at = models.DateTimeField(auto_now_add= True)
    zoho_pricebook_id = models.CharField(max_length=50, blank=True, null=True)
    zoho_contact_id = models.CharField(max_length=50, blank=True, null=True)
    rate = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return self.name
    

class Invoice(models.Model):
     # Status choices for the invoice
    STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('paid', 'Paid'),
       
    ]
    customer = models.ForeignKey(Customer,on_delete= models.CASCADE)
    invoice_number = models.CharField(unique= True, max_length= 300)
    amount = models.DecimalField(max_digits= 10,decimal_places= 2,blank = False, null = False)
    date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices= STATUS_CHOICES,default= "unpaid")
    created_at = models.DateTimeField(auto_now_add= True)
    manual_status = models.CharField(max_length= 10, choices= STATUS_CHOICES,blank = True, null = True )
    comment = models.TextField( blank= True, null = True)

    def __str__(self):
        return self.invoice_number
    

class Payment(models.Model):
     # Status choices for the payment
    STATUS_CHOICES = [
        ('matched', 'Matched'),
        ('unmatched', 'Unmatched'),
       
    ]
    customer = models.ForeignKey(Customer,on_delete= models.CASCADE)
    invoice = models.ForeignKey(Invoice,on_delete= models.CASCADE)
    amount_paid = models.DecimalField(max_digits= 10,decimal_places= 2,blank= False)
    payment_date = models.DateField()
    bank_reference = models.CharField(max_length= 50, blank= True, null= True)
    status = models.CharField(max_length=10, choices= STATUS_CHOICES,default= "unmatched")
    created_at = models.DateTimeField(auto_now_add= True)

    def __str__(self):
        return f'{self.customer} - {self.amount_paid}'
    

class ZohoToken(models.Model):
     # Stores Zoho OAuth tokens so dont have to re-authenticate every time the server restarts
    access_token = models.TextField()
    refresh_token = models.TextField()
    organization_id = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Zoho Token - {self.organization_id}'
    

class MenuItem(models.Model):
    name = models.CharField(max_length=200)
    product_code = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)
    zoho_item_id = models.CharField(max_length=100, blank = True, null = True)

    def __str__(self):
        return f'{self.product_code} - {self.name}'

class Ingredient(models.Model):
    name = models.CharField(max_length = 100, blank = True)
    unit = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add= True) 

    def __str__(self):
        return f'{self.name}  {(self.unit)}'
    
class MenuIngredient(models.Model):
    menu_item = models.ForeignKey(MenuItem, on_delete= models.CASCADE,related_name = "Ingredients")
    ingredient = models.ForeignKey(Ingredient, on_delete= models.CASCADE)
    amount_per_portion = models.DecimalField(max_digits= 10, decimal_places= 2)
    def __str__(self):
        return f'{self.menu_item.name} → {self.ingredient.name} ({self.amount_per_portion} {self.ingredient.unit})'
    
class DeliveryOrder(models.Model):
    delivery_date = models.DateField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def use_by_date(self):
        from datetime import timedelta
        return self.delivery_date + timedelta(days=15)
    
class DeliveryItem(models.Model):
    delivery_order = models.ForeignKey(DeliveryOrder, on_delete=models.CASCADE, related_name='items')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=0)

    class Meta:
        unique_together = ['delivery_order', 'customer', 'menu_item']


class GeneratedInvoice(models.Model):
    delivery_order = models.ForeignKey(DeliveryOrder, on_delete=models.CASCADE, related_name='generated_invoices')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    zoho_invoice_id = models.CharField(max_length=100)
    invoice_number = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['delivery_order', 'customer']

    def __str__(self):
        return f'{self.invoice_number} — {self.customer.name}'