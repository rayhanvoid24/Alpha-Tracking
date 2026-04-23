from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .serializers import RegisterSerializer, LoginSerializer
from .models import User,Customer,Invoice
from .zoho import get_zoho_auth_url, exchange_code_for_tokens, fetch_zoho_invoices, refresh_zoho_token
from .models import ZohoToken
from django.shortcuts import redirect
from django.conf import settings



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
    permission_classes= [] # no tokens needed
    #get the code Zoho sent back in the url
    def get(self,request):
        code = request.GET.get('code')
        if not code:
            return Response({
                "error": "code not provided"
            }, status= status.HTTP_400_BAD_REQUEST)
        
        token_data = exchange_code_for_tokens(code)
        print('TOKEN DATA:', token_data)

        if 'access_token' not in token_data:
            return Response({
                "error": "failed to get tokens from Zoho"
            }, status= status.HTTP_400_BAD_REQUEST)
           # Save tokens to database — delete old ones first

        ZohoToken.objects.all().delete()
        ZohoToken.objects.create(
            access_token = token_data["access_token"],
            refresh_token = token_data.get("refresh_token", " "),
            organization_id = request.GET.get("location", " ")
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

        for invoice in invoices['invoices']:
            customer,created = Customer.objects.get_or_create(
                name = invoice['customer_name'],
                defaults={
                 'email': invoice.get('email', ''),
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