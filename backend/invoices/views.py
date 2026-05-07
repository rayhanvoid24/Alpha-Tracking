from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .serializers import RegisterSerializer, LoginSerializer
from .models import User,Customer,Invoice,MenuItem,MenuIngredient,DeliveryItem,DeliveryOrder,GeneratedInvoice,SleeveInventory,CustomDeliveryEntry
from django.db import transaction
from .zoho import get_zoho_auth_url, exchange_code_for_tokens, fetch_zoho_invoices, refresh_zoho_token, fetch_zoho_items, create_zoho_invoice, delete_zoho_invoice
from .models import ZohoToken
from django.shortcuts import redirect
from django.conf import settings
from datetime import timedelta
import math




# Create your views here.

# Helper function — generates JWT tokens for a user -called after successful login or registration
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }
# Registration view — handles POST /api/auth/register
class RegisterView(APIView):
    permission_classes = []  ## no token needed, if it was needed that user wont be able to register

    # Creates a new staff user, pending admin approval

    def post(self,request):
        serializer = RegisterSerializer(data = request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "Registration successful. Wait for admin approval."
            }, status= status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status= status.HTTP_400_BAD_REQUEST)
    

class LoginView(APIView):
    permission_classes = [] ## no token needed, if it was needed that user wont be able to log in 

    ## allows user to log in

    def post(self,request):
        
        login = LoginSerializer(data = request.data)
        if login.is_valid():
            email = login.validated_data["email"]
            password = login.validated_data["password"]

            user = authenticate(request, username = email, password = password)

            if user is None:
               return Response({
                "error": " invalid email or password "
                }, status= status.HTTP_401_UNAUTHORIZED)
            
            if not user.is_approved:
                return Response({
                    "error": "your account is pending approval."
                }, status = status. HTTP_403_FORBIDDEN)
            ## final token before login
            tokens = get_tokens_for_user(user)
            return Response({
                "tokens": tokens,
                "user": {
                    "email": email,
                    "full_name": user.full_name,
                    "role": user.role,
                }
            }, status= status.HTTP_200_OK)
            
        return Response( login.errors, status= status.HTTP_400_BAD_REQUEST)
    
class ZohoConnectView(APIView):
    permission_classes= [] # no tokens needed
    def get(self, request):
         # Generate the Zoho authorization URL and redirect
        auth_url = get_zoho_auth_url()
        #print('zoho Auth URL:', auth_url)
        return redirect(auth_url)
       

    
# Zoho Callback view — handles GET /api/zoho/callback/
# Zoho redirects here after the user approves access
# Exchanges the code for tokens and saves them

class ZohoCallbackView(APIView):
    permission_classes = []

    def get(self, request):
        code = request.GET.get('code')
        if not code:
            return Response({'error': 'code not provided'}, status=status.HTTP_400_BAD_REQUEST)

        token_data = exchange_code_for_tokens(code)
        print('TOKEN DATA:', token_data)

        if 'access_token' not in token_data:
            return Response({'error': 'failed to get tokens from Zoho'}, status=status.HTTP_400_BAD_REQUEST)

        # Preserve existing refresh token if Zoho doesn't send a new one
        refresh_token = token_data.get('refresh_token', '')
        existing = ZohoToken.objects.first()
        if not refresh_token and existing:
            refresh_token = existing.refresh_token
        print('EXISTING REFRESH TOKEN:', existing.refresh_token if existing else 'NO EXISTING TOKEN')
        print('NEW REFRESH TOKEN FROM ZOHO:', token_data.get('refresh_token', 'NOT PROVIDED'))
        ZohoToken.objects.all().delete()
        ZohoToken.objects.create(
            access_token=token_data['access_token'],
            refresh_token=refresh_token,
            organization_id=request.GET.get('location', '')
        )

        return Response({'message': 'Zoho connected successfully!'}, status=status.HTTP_200_OK)
       
class ZohoInvoicesView(APIView):
    def get(self, request):
        # Get saved tokens from database
        try:
            token = ZohoToken.objects.latest('created_at')
        except ZohoToken.DoesNotExist:
            return Response({'error': 'Zoho not connected. Visit /api/zoho/connect/ first'}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch invoices from Zoho
        invoices = fetch_zoho_invoices(
            token.access_token,
            settings.ZOHO_ORGANIZATION_ID,
            refresh_token = token.refresh_token
        )
        if 'invoices' not in invoices:
            return Response({'error': 'Failed to fetch from Zoho. Please reconnect at /api/zoho/connect/'}, 
                            status=status.HTTP_400_BAD_REQUEST
                            )

        for invoice in invoices['invoices']:
            customer,created = Customer.objects.get_or_create(
                name = invoice['customer_name'],
                defaults={
                 'email': invoice.get('email', ''),
                 'zoho_contact_id': invoice.get('customer_id', ''),
            }

            )

            invoice_object,created = Invoice.objects.get_or_create(
                invoice_number = invoice['invoice_number'],
                customer = customer,
                amount = invoice['total'],
                date = invoice['date'],
                due_date = invoice['due_date'],

            )

        return Response(invoices, status=status.HTTP_200_OK)
    
class InvoiceListView(APIView):
    def get(self,request):
        #get all the invoices
        invoices = Invoice.objects.all().order_by('-date').select_related('customer')
        # the details are added to data which is empty at first, react will use the data to render info
        data = []
        for invoice in invoices:
           data.append({
               'id': invoice.id,
               'invoice_number': invoice.invoice_number,
               'customer': invoice.customer.name,
               'date': str(invoice.date),
               'total': str(invoice.amount),
               'due_date': str(invoice.due_date),
               'status': invoice.status,
               'manual_status': invoice.manual_status,
               'comment': invoice.comment,

           })

        return Response(data, status= status.HTTP_200_OK)
    

# Invoice Update view — handles PATCH /api/invoices/<id>/
# Allows staff to update manual status and comment

class InvoiceUpdateView(APIView):
    def patch(self, request, id):
        try:
            # Find the invoice by id
            invoice = Invoice.objects.get(id=id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)

        # Update only the fields that were sent
        manual_status = request.data.get('manual_status')
        comment = request.data.get('comment')

        if manual_status is not None:
            invoice.manual_status = manual_status
        if comment is not None:
            invoice.comment = comment

        invoice.save()

        return Response({
            'message': 'Invoice updated successfully',
            'manual_status': invoice.manual_status,
            'comment': invoice.comment,
        }, status=status.HTTP_200_OK)
    

class CreateInvoiceView(APIView):
    def post(self,request):
        #get the info from staff
        invoice_number = request.data.get('invoice_number')
        customer_name = request.data.get('customer_name')
        amount = request.data.get('amount')
        date = request.data.get('date')
        due_date = request.data.get('due_date')

        # Validate required fields
        if not all([invoice_number, customer_name, amount, date, due_date]):
            return Response(
                {'error': 'All fields are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find or create the customer
        customer, created = Customer.objects.get_or_create(
            name=customer_name
        )

        # Check if invoice number already exists
        if Invoice.objects.filter(invoice_number=invoice_number).exists():
            return Response(
                {'error': 'Invoice number already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the invoice
        invoice = Invoice.objects.create(
            invoice_number=invoice_number,
            customer=customer,
            amount=amount,
            date=date,
            due_date=due_date,
            status='unpaid',
        )

        return Response({
            'message': 'Invoice created successfully',
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
        }, status=status.HTTP_201_CREATED)
    
# -----------------------------------------------
# Invoice Delete view — handles DELETE /api/invoices/<id>/delete/
# Allows staff to delete manually added invoices
# -----------------------------------------------
class InvoiceDeleteView(APIView):
    def delete(self, request, id):
        try:
            invoice = Invoice.objects.get(id=id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)
        
        invoice.delete()
        return Response({'message': 'Invoice deleted successfully'}, status=status.HTTP_200_OK)
    

class ZohoSyncItemsView(APIView):
    def get(self,request):
        try:
            token = ZohoToken.objects.latest('created_at')
        except ZohoToken.DoesNotExist:
            return Response({'error': 'Zoho not connected'}, status= status.HTTP_400_BAD_REQUEST)
        
        items = fetch_zoho_items(token.access_token, settings.ZOHO_ORGANIZATION_ID,refresh_token= token.refresh_token)
        print('ZOHO ITEMS RESPONSE:', items)
        if 'new_access_token' in items:
          token.access_token = items.pop('new_access_token')
          token.save()

        if 'items' not in items:
            return Response({'error': 'Failed to fetch items'},status= status.HTTP_400_BAD_REQUEST)
        
        synced = 0
        not_found = []
        for item in items['items']:
            item_name = item.get('name', '').strip()
            zoho_item_id = item.get('item_id', '')

            try:
                menu_item = MenuItem.objects.get(product_code = item_name)
                menu_item.zoho_item_id = zoho_item_id
                menu_item.save()
                synced +=1
            except MenuItem.DoesNotExist:
                not_found.append(item_name)

        return Response({'message': f'synced {synced} items', 
                        'not_found': not_found}, status= status.HTTP_200_OK
                
                )

class ZohoSyncContactsView(APIView):
    def get(self, request):
        try:
            token = ZohoToken.objects.latest('created_at')
        except ZohoToken.DoesNotExist:
            return Response({'error': 'Zoho not connected'}, status=status.HTTP_400_BAD_REQUEST)

        from .zoho import fetch_zoho_contacts
        contacts = fetch_zoho_contacts(token.access_token, settings.ZOHO_ORGANIZATION_ID, refresh_token=token.refresh_token)

        if 'new_access_token' in contacts:
            token.access_token = contacts.pop('new_access_token')
            token.save()

        if 'contacts' not in contacts:
            return Response({'error': 'Failed to fetch contacts'}, status=status.HTTP_400_BAD_REQUEST)

        synced = 0
        not_found = []

        for contact in contacts['contacts']:
            contact_name = contact.get('contact_name', '').strip()
            zoho_contact_id = contact.get('contact_id', '')

            try:
                customer = Customer.objects.get(name=contact_name)
                customer.zoho_contact_id = zoho_contact_id
                customer.save()
                synced += 1
            except Customer.DoesNotExist:
                not_found.append(contact_name)

        return Response({
            'message': f'Synced {synced} contacts',
            'not_found': not_found,
        }, status=status.HTTP_200_OK)
    
class MenuItemView(APIView):
    #get the active items, so react can display items at the top
    def get(self,request):
        items = MenuItem.objects.filter(is_active = True).order_by('id')
        data = []
        for item in items:
            data.append( {
                'id': item.id,
                'name': item.name,
                'code': item.product_code,
                }
            )

        return Response(data, status= status.HTTP_200_OK)
    
class CustomerListView(APIView):
    def get(self, request):
        customers = Customer.objects.all()
        data = []
        for customer in customers:
            data.append({
                'id': customer.id,
                'name': customer.name,
                'zoho_contact_id': customer.zoho_contact_id,
                'rate': str(customer.rate) if customer.rate is not None else None,
            })
        return Response(data, status=status.HTTP_200_OK)


class CustomerUpdateView(APIView):
    def patch(self, request, id):
        try:
            customer = Customer.objects.get(id=id)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        rate = request.data.get('rate')
        if rate is not None:
            customer.rate = rate
        customer.save()

        return Response({
            'id': customer.id,
            'name': customer.name,
            'rate': str(customer.rate) if customer.rate is not None else None,
        }, status=status.HTTP_200_OK)
    
class DeliveryOrderView(APIView):
    def post(self, request):
        from datetime import datetime
        delivery_date = request.data.get('delivery_date')
        
        if not delivery_date:
            return Response({'error': 'Delivery date is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse the date
        try:
            date_obj = datetime.strptime(delivery_date,  '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check it's a Monday
        if date_obj.weekday() != 0:
            return Response({'error': 'Delivery date must be a Monday'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create the delivery order
        order, created = DeliveryOrder.objects.get_or_create(
            delivery_date=date_obj,
            defaults={'created_by': request.user}
        )
        
        return Response({
            'id': order.id,
            'delivery_date': str(order.delivery_date),
            'use_by_date': str(order.use_by_date),
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def get(self, request, date=None):
        if not date:
            return Response({'error': 'Date is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            order = DeliveryOrder.objects.get(delivery_date=date)
        except DeliveryOrder.DoesNotExist:
            return Response({'error': 'No delivery order found for this date'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get all items for this order
        items = DeliveryItem.objects.filter(delivery_order=order).select_related('customer', 'custom_entry', 'menu_item')
        items_data = []
        for item in items:
            entry = {
                'menu_item_id': item.menu_item.id,
                'quantity': item.quantity,
            }
            if item.customer_id:
                entry['customer_id'] = item.customer.id
            else:
                entry['custom_entry_id'] = item.custom_entry.id
                entry['custom_entry_name'] = item.custom_entry.name
            items_data.append(entry)
        
        invoiced_ids = list(
            GeneratedInvoice.objects.filter(delivery_order=order).values_list('customer_id', flat=True)
        )

        return Response({
            'id': order.id,
            'delivery_date': str(order.delivery_date),
            'use_by_date': str(order.use_by_date),
            'is_delivered': order.is_delivered,
            'items': items_data,
            'invoiced_customer_ids': invoiced_ids,
        }, status=status.HTTP_200_OK)
    
# Saves a quantity for a customer x dish cell
# -----------------------------------------------
class DeliveryItemView(APIView):
    def patch(self, request, order_id):
        customer_id = request.data.get('customer_id')
        menu_item_id = request.data.get('menu_item_id')
        quantity = request.data.get('quantity', 0)

        if not customer_id or not menu_item_id:
            return Response({'error': 'customer_id and menu_item_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = DeliveryOrder.objects.get(id=order_id)
        except DeliveryOrder.DoesNotExist:
            return Response({'error': 'Delivery order not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get or create the cell
        item, created = DeliveryItem.objects.get_or_create(
            delivery_order=order,
            customer_id=customer_id,
            menu_item_id=menu_item_id,
            defaults={'quantity': quantity}
        )

        # Update quantity if already exists
        if not created:
            item.quantity = quantity
            item.save()

        return Response({
            'customer_id': customer_id,
            'menu_item_id': menu_item_id,
            'quantity': item.quantity,
        }, status=status.HTTP_200_OK)
    
# Bulk save all delivery items for an order in one transaction
# -----------------------------------------------
class BulkSaveDeliveryView(APIView):
    def post(self, request, order_id):
        try:
            order = DeliveryOrder.objects.get(id=order_id)
        except DeliveryOrder.DoesNotExist:
            return Response({'error': 'Delivery order not found'}, status=status.HTTP_404_NOT_FOUND)

        items = request.data.get('items', [])

        with transaction.atomic():
            DeliveryItem.objects.filter(delivery_order=order).delete()
            CustomDeliveryEntry.objects.filter(delivery_order=order).delete()

            custom_entry_cache = {}
            for item in items:
                qty = item.get('quantity', 0)
                if qty <= 0:
                    continue
                menu_item_id = item.get('menu_item_id')
                if item.get('customer_id'):
                    DeliveryItem.objects.create(
                        delivery_order=order,
                        customer_id=item['customer_id'],
                        menu_item_id=menu_item_id,
                        quantity=qty,
                    )
                elif item.get('custom_name'):
                    name = item['custom_name']
                    if name not in custom_entry_cache:
                        custom_entry_cache[name] = CustomDeliveryEntry.objects.create(
                            delivery_order=order,
                            name=name,
                        )
                    DeliveryItem.objects.create(
                        delivery_order=order,
                        custom_entry=custom_entry_cache[name],
                        menu_item_id=menu_item_id,
                        quantity=qty,
                    )

        # Return the saved state in the same shape as GET /delivery/<date>/
        saved_items = DeliveryItem.objects.filter(delivery_order=order).select_related('customer', 'custom_entry', 'menu_item')
        items_data = []
        for item in saved_items:
            entry = {'menu_item_id': item.menu_item.id, 'quantity': item.quantity}
            if item.customer_id:
                entry['customer_id'] = item.customer.id
            else:
                entry['custom_entry_id'] = item.custom_entry.id
                entry['custom_entry_name'] = item.custom_entry.name
            items_data.append(entry)

        invoiced_ids = list(
            GeneratedInvoice.objects.filter(delivery_order=order).values_list('customer_id', flat=True)
        )

        return Response({
            'id': order.id,
            'delivery_date': str(order.delivery_date),
            'use_by_date': str(order.use_by_date),
            'is_delivered': order.is_delivered,
            'items': items_data,
            'invoiced_customer_ids': invoiced_ids,
        }, status=status.HTTP_200_OK)


# Takes delivery order ID, calculates all kitchen prep quantities
# Returns structured data for Page 2 display

class KitchenPrepView(APIView):
    def get(self, request, order_id):
        # ── Step 1: Get the delivery order ──
        try:
            order = DeliveryOrder.objects.get(id=order_id)
        except DeliveryOrder.DoesNotExist:
            return Response({'error': 'Delivery order not found'}, status=status.HTTP_404_NOT_FOUND)

        # ── Step 2: Sum quantities per product code ──
        # Build a dictionary like {'1001': 54, '2005': 44, ...}
        items = DeliveryItem.objects.filter(delivery_order=order)
        totals = {}
        for item in items:
            code = item.menu_item.product_code
            totals[code] = totals.get(code, 0) + item.quantity

        # ── Helper: round up to nearest X ──
        
        def round_up(value, nearest):
            return math.ceil(value / nearest) * nearest

        # ── Step 3: Rice calculations ──
        white_rice = round_up(
            (totals.get('2004', 0) + totals.get('1006', 0)) / 19, 0.5
        )
        leb_rice = round_up(totals.get('2002', 0) / 14, 0.5)
        jasmine_rice = round_up(
            (totals.get('1008', 0) + totals.get('4002', 0) + totals.get('3004', 0) + totals.get('3005', 0)) / 16
            + (totals.get('2006', 0) / 14), 0.5
        )

        # ── Step 4: Chicken calculations ──
        chicken_thigh_tikka = round_up(totals.get('2004', 0) * 0.14, 0.5)
        chicken_thigh_curry = round_up((totals.get('3004', 0) + totals.get('3005', 0)) * 0.15, 0.5)
        chicken_breast_leb = round_up(totals.get('2002', 0) * 0.13, 1)
        chicken_breast_sliced = round_up((totals.get('2005', 0) + totals.get('2003', 0)) / 14 * 2, 1)
        chicken_thigh_mince = round_up(totals.get('2006', 0) * 0.15 * 1.15 + 0.5, 0.1)

        # ── Step 5: Tray calculations (needed for sauces) ──
        def get_trays(total, portions_per_tray=12):
            trays = total // portions_per_tray
            leftover = total % portions_per_tray
            if leftover > 0 and leftover <= 6:
                trays += 0.5
            elif leftover > 6:
                trays += 1
            return trays

        trays_1001 = get_trays(totals.get('1001', 0))
        trays_3003 = get_trays(totals.get('3003', 0))

        # ── Step 6: Sauce calculations ──
        napoletane = round_up(trays_3003 / 0.5, 0.5)
        bechamel = trays_1001 * 1

        tikka_total = totals.get('2004', 0)
        if tikka_total < 12:
            tikka_sauce = 1.0
        elif tikka_total <= 23:
            tikka_sauce = 2.0
        elif tikka_total <= 31:
            tikka_sauce = 2.5
        elif tikka_total <= 64:
            tikka_sauce = 5.0
        else:
            tikka_sauce = 7.5

        pesto_total = totals.get('2005', 0)
        if pesto_total < 50:
            pesto_sauce = 1.65
        elif pesto_total <= 59:
            pesto_sauce = 2.0
        elif pesto_total <= 79:
            pesto_sauce = 2.5
        else:
            pesto_sauce = 3.0

        # ── Step 7: Pasta calculations ──
        penne = math.ceil((totals.get('1007', 0) / 6.25) -2)
        casarecce = max(0, round_up((totals.get('2005', 0) / 7.25) - 1, 0.5))
        pea_risotto = round_up(totals.get('2003', 0) * 290 / 4700, 0.25)
        spaghetti = round_up(totals.get('1389', 0) * 80 / 1000, 0.1)

        # ── Step 8: Beef mince calculations ──
        chili_mince = totals.get('1006', 0) * 100
        leb_mince = totals.get('2002', 0) * 70
        total_mince = (
        (totals.get('1007', 0) * 80) +
        (totals.get('1389', 0) * 80) +
        (totals.get('1001', 0) * 110) +
        chili_mince + leb_mince + 2000
         )
        bolognese_mince = total_mince - chili_mince - leb_mince

        # ── Step 9: Return everything ──
        return Response({
            'delivery_date': str(order.delivery_date),
            'use_by_date': str(order.use_by_date),
            'totals': totals,
            'rice': {
                'white_rice': white_rice,
                'leb_rice': leb_rice,
                'jasmine_rice': jasmine_rice,
            },
            'chicken': {
                'thigh_tikka': chicken_thigh_tikka,
                'thigh_curry': chicken_thigh_curry,
                'breast_leb': chicken_breast_leb,
                'breast_sliced': chicken_breast_sliced,
                'thigh_mince': chicken_thigh_mince,
            },
            'sauces': {
                'napoletane': napoletane,
                'bechamel': bechamel,
                'tikka': tikka_sauce,
                'pesto': pesto_sauce,
            },
            'pasta': {
                'penne': penne,
                'casarecce': casarecce,
                'spaghetti': spaghetti,
                'pea_risotto': pea_risotto,
            },
            'beef_mince': {
                'chili': round_up(chili_mince / 1000, 0.5),
                'leb_rice': round_up(leb_mince / 1000, 0.5),
                'total': total_mince / 1000,
                'bolognese': bolognese_mince / 1000,
            },
        }, status=status.HTTP_200_OK)


class GenerateInvoiceView(APIView):
    def post(self, request, order_id, customer_id):
        due_date = request.data.get('due_date')
        invoice_date = request.data.get('invoice_date')
        if not due_date:
            return Response({'error': 'due_date is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not invoice_date:
            return Response({'error': 'invoice_date is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = DeliveryOrder.objects.get(id=order_id)
        except DeliveryOrder.DoesNotExist:
            return Response({'error': 'Delivery order not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        if not customer.zoho_contact_id:
            return Response({'error': f'{customer.name} has no Zoho contact ID. Run Zoho contact sync first.'}, status=status.HTTP_400_BAD_REQUEST)

        if customer.rate is None:
            return Response({'error': f'{customer.name} has no rate set. Set a rate in Settings first.'}, status=status.HTTP_400_BAD_REQUEST)

        if GeneratedInvoice.objects.filter(delivery_order=order, customer=customer).exists():
            return Response({'error': 'Invoice already generated for this customer and delivery.'}, status=status.HTTP_409_CONFLICT)

        items = DeliveryItem.objects.filter(delivery_order=order, customer=customer, quantity__gt=0).select_related('menu_item')

        if not items.exists():
            return Response({'error': f'{customer.name} has no items in this delivery order.'}, status=status.HTTP_400_BAD_REQUEST)

        missing_zoho_id = [item.menu_item.name for item in items if not item.menu_item.zoho_item_id]
        if missing_zoho_id:
            return Response({'error': f'These items are missing Zoho item IDs: {", ".join(missing_zoho_id)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = ZohoToken.objects.latest('created_at')
        except ZohoToken.DoesNotExist:
            return Response({'error': 'Zoho not connected.'}, status=status.HTTP_400_BAD_REQUEST)

        gst_tax_id = settings.ZOHO_GST_TAX_ID
        line_items = []
        for item in items:
            line_item = {
                'item_id': item.menu_item.zoho_item_id,
                'quantity': item.quantity,
                'rate': float(customer.rate),
            }
            if gst_tax_id:
                line_item['tax_id'] = gst_tax_id
            line_items.append(line_item)

        payload = {
            'customer_id': customer.zoho_contact_id,
            'date': invoice_date,
            'due_date': due_date,
            'line_items': line_items,
        }

        result = create_zoho_invoice(
            token.access_token,
            settings.ZOHO_ORGANIZATION_ID,
            payload,
            refresh_token=token.refresh_token,
        )

        if 'new_access_token' in result:
            token.access_token = result.pop('new_access_token')
            token.save()

        if result.get('code') != 0:
            return Response({'error': f'Zoho error: {result.get("message", "Unknown error")}'}, status=status.HTTP_400_BAD_REQUEST)

        zoho_invoice = result.get('invoice', {})
        GeneratedInvoice.objects.create(
            delivery_order=order,
            customer=customer,
            zoho_invoice_id=zoho_invoice.get('invoice_id', ''),
            invoice_number=zoho_invoice.get('invoice_number', ''),
        )

        return Response({
            'invoice_number': zoho_invoice.get('invoice_number'),
            'zoho_invoice_id': zoho_invoice.get('invoice_id'),
            'customer': customer.name,
            'invoice_date': invoice_date,
            'due_date': due_date,
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, order_id, customer_id):
        try:
            order = DeliveryOrder.objects.get(id=order_id)
        except DeliveryOrder.DoesNotExist:
            return Response({'error': 'Delivery order not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            generated = GeneratedInvoice.objects.get(delivery_order=order, customer=customer)
        except GeneratedInvoice.DoesNotExist:
            return Response({'error': 'No generated invoice found for this customer and delivery.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            token = ZohoToken.objects.latest('created_at')
        except ZohoToken.DoesNotExist:
            return Response({'error': 'Zoho not connected.'}, status=status.HTTP_400_BAD_REQUEST)

        result = delete_zoho_invoice(
            token.access_token,
            settings.ZOHO_ORGANIZATION_ID,
            generated.zoho_invoice_id,
            refresh_token=token.refresh_token,
        )

        if 'new_access_token' in result:
            token.access_token = result.pop('new_access_token')
            token.save()

        if result.get('code') != 0:
            return Response({'error': f'Zoho error: {result.get("message", "Unknown error")}'}, status=status.HTTP_400_BAD_REQUEST)

        generated.delete()
        return Response({'message': 'Invoice deleted successfully'}, status=status.HTTP_200_OK)


class SleeveInventoryView(APIView):
    def get(self, request):
        menu_items = MenuItem.objects.filter(is_active=True).order_by('product_code')
        result = []
        for item in menu_items:
            inv, _ = SleeveInventory.objects.get_or_create(menu_item=item)
            result.append({
                'menu_item_id': item.id,
                'product_code': item.product_code,
                'name': item.name,
                'quantity': inv.quantity,
            })
        return Response(result, status=status.HTTP_200_OK)

    def post(self, request):
        updates = request.data
        if not isinstance(updates, list):
            return Response({'error': 'Expected a list of {menu_item_id, quantity}'}, status=status.HTTP_400_BAD_REQUEST)
        for update in updates:
            mid = update.get('menu_item_id')
            qty = update.get('quantity')
            if mid is None or qty is None:
                continue
            try:
                qty = max(0, int(qty))
            except (TypeError, ValueError):
                continue
            inv, _ = SleeveInventory.objects.get_or_create(menu_item_id=mid)
            inv.quantity = qty
            inv.save()
        return Response({'message': 'Inventory saved.'}, status=status.HTTP_200_OK)


class ResetSleeveInventoryView(APIView):
    def post(self, request):
        SleeveInventory.objects.all().update(quantity=0)
        return Response({'message': 'Inventory reset to 0.'}, status=status.HTTP_200_OK)


class MarkDeliveredView(APIView):
    def post(self, request, order_id):
        try:
            order = DeliveryOrder.objects.get(id=order_id)
        except DeliveryOrder.DoesNotExist:
            return Response({'error': 'Delivery order not found'}, status=status.HTTP_404_NOT_FOUND)

        if order.is_delivered:
            return Response({'error': 'This delivery has already been marked as delivered.'}, status=status.HTTP_409_CONFLICT)

        items = DeliveryItem.objects.filter(delivery_order=order, quantity__gt=0).select_related('menu_item')

        totals = {}
        for item in items:
            totals[item.menu_item_id] = totals.get(item.menu_item_id, 0) + item.quantity

        for menu_item_id, qty in totals.items():
            inv, _ = SleeveInventory.objects.get_or_create(menu_item_id=menu_item_id)
            inv.quantity = max(0, inv.quantity - qty)
            inv.save()

        order.is_delivered = True
        order.save()

        inventory = SleeveInventory.objects.select_related('menu_item').filter(menu_item__is_active=True).order_by('menu_item__product_code')
        inventory_data = [
            {'menu_item_id': inv.menu_item_id, 'name': inv.menu_item.name, 'quantity': inv.quantity}
            for inv in inventory
        ]

        return Response({
            'message': 'Delivery marked as complete. Inventory updated.',
            'inventory': inventory_data,
        }, status=status.HTTP_200_OK)
