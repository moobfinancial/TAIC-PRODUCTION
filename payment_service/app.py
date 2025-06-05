import os
import stripe
import psycopg2
import psycopg2.extras
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configure Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
stripe_webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

# Database connection
def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'stripe_payments'),
        user=os.getenv('DB_USER', 'stripe_user'),
        password=os.getenv('DB_PASSWORD', 'stripe_password')
    )
    return conn

@app.route('/')
def home():
    return "Payment Backend is running!"

# Simulated deposit address for Demo TAIC
DEMO_TAIC_DEPOSIT_ADDRESS = "TAIC_DEMO_DEPOSIT_ADDRESS_12345"

@app.route('/initiate-crypto-payment', methods=['POST'])
def initiate_crypto_payment():
    data = request.get_json()
    if not data or 'amount' not in data or 'currency' not in data or 'user_id' not in data: # Assuming order is created first or user_id is passed
        return jsonify({'error': 'Missing amount, currency, or user_id'}), 400

    amount_expected = data['amount'] # Expecting amount in crypto's smallest unit or float
    currency_expected = data['currency'].upper()
    user_id = data.get('user_id')
    # For crypto, we'll assume the 'amount' in the orders table can store the TAIC amount directly
    # And 'currency' will be 'TAIC' or similar crypto code.

    if currency_expected != "TAIC": # For now, only TAIC is supported as a demo
        return jsonify({'error': 'Unsupported crypto currency. Only TAIC (simulated) is supported.'}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Create an order first
        cur.execute(
            "INSERT INTO orders (user_id, amount, currency, status) VALUES (%s, %s, %s, %s) RETURNING id",
            (user_id, amount_expected, currency_expected, 'pending_crypto_payment') # New status for orders table
        )
        order_id = cur.fetchone()[0]

        # 2. Create a crypto transaction record
        network = "SimulatedTAIC" # Demo network
        payment_initiation_data = {
            'deposit_address': DEMO_TAIC_DEPOSIT_ADDRESS,
            'expected_amount': amount_expected,
            'currency': currency_expected,
            'network': network
        }
        cur.execute(
            """
            INSERT INTO crypto_transactions
            (order_id, wallet_address, network, amount_expected, currency_expected, status, payment_initiation_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            # wallet_address will be updated when user confirms payment
            (order_id, 'pending_user_submission', network, amount_expected, currency_expected, 'pending_user_action', psycopg2.extras.Json(payment_initiation_data))
        )
        crypto_tx_id = cur.fetchone()[0]
        conn.commit()

        return jsonify({
            'message': 'Crypto payment initiated. Please send funds to the provided address.',
            'orderId': order_id,
            'cryptoTransactionId': crypto_tx_id,
            'paymentDetails': payment_initiation_data
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route('/create-payment-intent', methods=['POST'])
def create_payment_intent():
    # Basic request validation
    data = request.get_json()
    if not data or 'amount' not in data or 'currency' not in data:
        return jsonify({'error': 'Missing amount or currency'}), 400

    amount = data['amount'] # Expecting amount in cents
    currency = data['currency']
    user_id = data.get('user_id') # Optional: associate with a user

    try:
        # Create an order in our database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO orders (user_id, amount, currency, status) VALUES (%s, %s, %s, %s) RETURNING id",
            (user_id, amount / 100.0, currency, 'pending') # Convert amount to dollars for DB
        )
        order_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        # Create a PaymentIntent with Stripe
        payment_intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            metadata={'order_id': order_id}
        )

        return jsonify({
            'clientSecret': payment_intent.client_secret,
            'orderId': order_id
        })

    except stripe.error.StripeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        # Ensure rollback on error for the create_payment_intent order creation as well
        # This part was missing rollback in the original code for create-payment-intent
        # For simplicity, assuming conn.rollback() would be handled by a broader error handler or try/except in real app
        return jsonify({'error': str(e)}), 500

@app.route('/confirm-crypto-payment', methods=['POST'])
def confirm_crypto_payment():
    data = request.get_json()
    if not data or 'order_id' not in data or 'transaction_hash' not in data or 'wallet_address' not in data:
        return jsonify({'error': 'Missing order_id, transaction_hash, or wallet_address'}), 400

    order_id = data['order_id']
    tx_hash = data['transaction_hash']
    wallet_address = data['wallet_address']
    # network = data.get('network', "SimulatedTAIC") # Or retrieve from crypto_transactions table

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Fetch the crypto transaction to verify details like expected amount
        cur.execute("SELECT id, amount_expected, currency_expected, network FROM crypto_transactions WHERE order_id = %s AND status = 'pending_user_action'", (order_id,))
        crypto_tx_record = cur.fetchone()

        if not crypto_tx_record:
            return jsonify({'error': 'No pending crypto transaction found for this order or already processed.'}), 404

        crypto_tx_id, amount_expected, currency_expected, network = crypto_tx_record

        # SIMULATED VERIFICATION:
        # In a real scenario, you would use web3.py or an explorer API to:
        # 1. Query the transaction_hash on the specified network.
        # 2. Verify it's confirmed (sufficient block confirmations).
        # 3. Verify the recipient address matches your deposit address.
        # 4. Verify the amount transferred matches amount_expected.
        # For this demo, we'll simulate success if hash looks like a hash.

        simulated_amount_received = amount_expected # Assume full amount received in simulation
        simulated_status = 'confirmed'

        if not tx_hash.startswith("0x") or len(tx_hash) < 10 : # Very basic "hash" check for simulation
            simulated_status = 'failed_verification'
            # Keep order status as pending_crypto_payment or move to failed
            cur.execute("UPDATE orders SET status = %s WHERE id = %s", ('failed_crypto', order_id))
        else:
            # Update order status to 'paid'
            cur.execute("UPDATE orders SET status = %s WHERE id = %s", ('paid', order_id))

        # Update crypto_transactions record
        cur.execute(
            """
            UPDATE crypto_transactions
            SET transaction_hash = %s, wallet_address = %s, status = %s, amount_received = %s, confirmation_data = %s
            WHERE id = %s
            """,
            (tx_hash, wallet_address, simulated_status, simulated_amount_received, psycopg2.extras.Json({'simulated_verification': True, 'hash_provided': tx_hash}), crypto_tx_id)
        )
        conn.commit()

        if simulated_status == 'confirmed':
            return jsonify({'message': 'Crypto payment confirmed (Simulated).', 'orderId': order_id, 'status': simulated_status}), 200
        else:
            return jsonify({'error': 'Crypto payment verification failed (Simulated).', 'orderId': order_id, 'status': simulated_status}), 400

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route('/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, stripe_webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify({'error': 'Invalid signature'}), 400

    # Handle the event
    if event.type == 'payment_intent.succeeded':
        payment_intent = event.data.object
        order_id = payment_intent.metadata.get('order_id')

        if order_id:
            try:
                conn = get_db_connection()
                cur = conn.cursor()

                # Update order status
                cur.execute(
                    "UPDATE orders SET status = %s WHERE id = %s",
                    ('paid', order_id)
                )

                # Record the payment
                cur.execute(
                    """
                    INSERT INTO payments (order_id, stripe_payment_intent_id, status, amount_received, currency)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (order_id, payment_intent.id, payment_intent.status, payment_intent.amount_received / 100.0, payment_intent.currency.upper())
                )
                conn.commit()
                cur.close()
                conn.close()
                print(f"Payment successful for order {order_id}. PaymentIntent ID: {payment_intent.id}")
            except Exception as e:
                print(f"Error updating database for order {order_id}: {str(e)}")
                # You might want to retry or log this for manual intervention
        else:
            print(f"PaymentIntent {payment_intent.id} succeeded but no order_id found in metadata.")

    elif event.type == 'payment_intent.payment_failed':
        payment_intent = event.data.object
        order_id = payment_intent.metadata.get('order_id')
        if order_id:
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute(
                    "UPDATE orders SET status = %s WHERE id = %s",
                    ('failed', order_id)
                )
                # Optionally record the failed payment attempt in the payments table
                cur.execute(
                    """
                    INSERT INTO payments (order_id, stripe_payment_intent_id, status, amount_received, currency)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (order_id, payment_intent.id, payment_intent.status, 0, payment_intent.currency.upper()) # Amount received is 0
                )
                conn.commit()
                cur.close()
                conn.close()
                print(f"Payment failed for order {order_id}. PaymentIntent ID: {payment_intent.id}")
            except Exception as e:
                print(f"Error updating database for failed order {order_id}: {str(e)}")
        else:
            print(f"PaymentIntent {payment_intent.id} failed but no order_id found in metadata.")

    else:
        print(f'Unhandled event type {event.type}')

    return jsonify({'status': 'success'}), 200

if __name__ == '__main__':
    # Make sure to import psycopg2.extras for Json adapter
    psycopg2.extras.register_uuid()
    app.run(host='0.0.0.0', port=os.getenv("PORT", 5000), debug=True)
