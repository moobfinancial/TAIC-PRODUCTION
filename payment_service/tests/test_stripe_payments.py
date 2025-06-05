import json
from unittest.mock import patch, MagicMock # Add MagicMock here
import stripe # Import stripe

# Test for /create-payment-intent
def test_create_payment_intent_success(client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection

    # Simulate DB returning an order ID
    mock_cur.fetchone.return_value = (1,) # New order ID is 1

    # Mock Stripe's PaymentIntent.create method
    with patch('stripe.PaymentIntent.create') as mock_stripe_create:
        mock_stripe_create.return_value = MagicMock(
            client_secret='cs_test_clientsecret',
            id='pi_test_paymentintentid',
            status='requires_payment_method',
            amount=1000,
            currency='usd'
        )

        response = client.post('/create-payment-intent', json={
            'amount': 1000, # in cents
            'currency': 'usd',
            'user_id': 'user123'
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data['clientSecret'] == 'cs_test_clientsecret'
        assert data['orderId'] == 1

        # Verify DB calls
        mock_cur.execute.assert_any_call(
            "INSERT INTO orders (user_id, amount, currency, status) VALUES (%s, %s, %s, %s) RETURNING id",
            ('user123', 10.00, 'usd', 'pending') # amount converted to dollars
        )
        mock_conn.commit.assert_called_once()

        # Verify Stripe call
        mock_stripe_create.assert_called_once_with(
            amount=1000,
            currency='usd',
            metadata={'order_id': 1}
        )

def test_create_payment_intent_missing_data(client):
    response = client.post('/create-payment-intent', json={
        'amount': 1000
        # currency is missing
    })
    assert response.status_code == 400
    data = response.get_json()
    assert 'Missing amount or currency' in data['error']

def test_create_payment_intent_stripe_error(client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection
    mock_cur.fetchone.return_value = (1,)

    with patch('stripe.PaymentIntent.create') as mock_stripe_create:
        mock_stripe_create.side_effect = stripe.error.StripeError("Stripe API error")

        response = client.post('/create-payment-intent', json={
            'amount': 1000,
            'currency': 'usd',
            'user_id': 'user123'
        })

        assert response.status_code == 400 # As per current error handling in app.py
        data = response.get_json()
        assert 'Stripe API error' in data['error']

# Tests for /stripe-webhook
@patch('stripe.Webhook.construct_event')
def test_stripe_webhook_payment_intent_succeeded(mock_construct_event, client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection

    # Mock Stripe event object
    mock_event = MagicMock()
    mock_event.type = 'payment_intent.succeeded'
    mock_event.data.object = MagicMock(
        id='pi_test_succeeded',
        amount_received=1000,
        currency='usd',
        status='succeeded',
        metadata={'order_id': '1'}
    )
    mock_construct_event.return_value = mock_event

    response = client.post('/stripe-webhook',
                           data='{"type": "payment_intent.succeeded", ...}', # Raw payload
                           headers={'Stripe-Signature': 't=testtime,v1=testsig'})

    assert response.status_code == 200
    assert response.get_json()['status'] == 'success'

    # Verify DB calls for updating order and inserting payment
    mock_cur.execute.assert_any_call(
        "UPDATE orders SET status = %s WHERE id = %s",
        ('paid', '1')
    )
    mock_cur.execute.assert_any_call(
        """
                    INSERT INTO payments (order_id, stripe_payment_intent_id, status, amount_received, currency)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
        ('1', 'pi_test_succeeded', 'succeeded', 10.00, 'USD') # amount converted, currency uppercased
    )
    assert mock_conn.commit.call_count == 1 # Should be 1 commit after all DB operations for this event

@patch('stripe.Webhook.construct_event')
def test_stripe_webhook_payment_intent_failed(mock_construct_event, client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection

    mock_event = MagicMock()
    mock_event.type = 'payment_intent.payment_failed'
    mock_event.data.object = MagicMock(
        id='pi_test_failed',
        currency='usd',
        status='failed',
        metadata={'order_id': '2'}
    )
    mock_construct_event.return_value = mock_event

    response = client.post('/stripe-webhook',
                           data='{"type": "payment_intent.payment_failed", ...}',
                           headers={'Stripe-Signature': 't=testtime,v1=testsig'})

    assert response.status_code == 200
    assert response.get_json()['status'] == 'success'

    mock_cur.execute.assert_any_call(
        "UPDATE orders SET status = %s WHERE id = %s",
        ('failed', '2')
    )
    mock_cur.execute.assert_any_call(
        """
                    INSERT INTO payments (order_id, stripe_payment_intent_id, status, amount_received, currency)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
        ('2', 'pi_test_failed', 'failed', 0, 'USD')
    )
    assert mock_conn.commit.call_count == 1

@patch('stripe.Webhook.construct_event')
def test_stripe_webhook_invalid_signature(mock_construct_event, client):
    mock_construct_event.side_effect = stripe.error.SignatureVerificationError("Invalid signature", "sig_header")

    response = client.post('/stripe-webhook',
                           data='payload_body',
                           headers={'Stripe-Signature': 'invalid_sig_header'})

    assert response.status_code == 400
    data = response.get_json()
    assert 'Invalid signature' in data['error']

@patch('stripe.Webhook.construct_event')
def test_stripe_webhook_unhandled_event_type(mock_construct_event, client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection # Even if not used, fixture is initialized

    mock_event = MagicMock()
    mock_event.type = 'some.other.event_type'
    mock_construct_event.return_value = mock_event

    response = client.post('/stripe-webhook',
                           data='{"type": "some.other.event_type", ...}',
                           headers={'Stripe-Signature': 't=testtime,v1=testsig'})

    assert response.status_code == 200 # App currently returns 200 for unhandled known events
    assert response.get_json()['status'] == 'success'
    # Ensure no database commits happened for unhandled event
    mock_conn.commit.assert_not_called()
