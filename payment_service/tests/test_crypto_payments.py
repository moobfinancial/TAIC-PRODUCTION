import json
from unittest.mock import patch, MagicMock
import psycopg2.extras # Required for Json in app code

# Test for /initiate-crypto-payment
def test_initiate_crypto_payment_success(client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection

    # Simulate DB returning an order ID and then a crypto_transaction ID
    mock_cur.fetchone.side_effect = [(1,), (101,)] # order_id=1, crypto_tx_id=101

    response = client.post('/initiate-crypto-payment', json={
        'amount': 100.0, # TAIC amount
        'currency': 'TAIC',
        'user_id': 'user123'
    })

    assert response.status_code == 201
    data = response.get_json()
    assert data['message'] == 'Crypto payment initiated. Please send funds to the provided address.'
    assert data['orderId'] == 1
    assert data['cryptoTransactionId'] == 101
    assert data['paymentDetails']['deposit_address'] == "TAIC_DEMO_DEPOSIT_ADDRESS_12345"
    assert data['paymentDetails']['expected_amount'] == 100.0
    assert data['paymentDetails']['currency'] == 'TAIC'

    # Verify DB calls
    mock_cur.execute.assert_any_call(
        "INSERT INTO orders (user_id, amount, currency, status) VALUES (%s, %s, %s, %s) RETURNING id",
        ('user123', 100.0, 'TAIC', 'pending_crypto_payment')
    )

    # Check the call to insert into crypto_transactions more carefully
    found_crypto_insert = False
    expected_payment_init_data = {
        'deposit_address': "TAIC_DEMO_DEPOSIT_ADDRESS_12345",
        'expected_amount': 100.0,
        'currency': 'TAIC',
        'network': 'SimulatedTAIC'
    }
    for call_args in mock_cur.execute.call_args_list:
        args, _ = call_args
        if "INSERT INTO crypto_transactions" in args[0]:
                assert args[1][0] == 1  # order_id
                assert args[1][1] == 'pending_user_submission' # wallet_address
                assert args[1][2] == 'SimulatedTAIC' # network
                assert args[1][3] == 100.0 # amount_expected
                assert args[1][4] == 'TAIC' # currency_expected
                assert args[1][5] == 'pending_user_action' # status
                # Compare the adapted_object of the Json wrapper
                assert args[1][6].adapted == expected_payment_init_data
                found_crypto_insert = True
                break
    assert found_crypto_insert, "Call to insert into crypto_transactions not found or args mismatch"

    assert mock_conn.commit.call_count == 1

def test_initiate_crypto_payment_missing_data(client):
    response = client.post('/initiate-crypto-payment', json={'amount': 100.0})
    assert response.status_code == 400
    data = response.get_json()
    assert 'Missing amount, currency, or user_id' in data['error']

def test_initiate_crypto_payment_unsupported_currency(client):
    response = client.post('/initiate-crypto-payment', json={
        'amount': 1.0,
        'currency': 'BTC',
        'user_id': 'user123'
    })
    assert response.status_code == 400
    data = response.get_json()
    assert 'Unsupported crypto currency' in data['error']

# Tests for /confirm-crypto-payment
def test_confirm_crypto_payment_success_simulated(client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection
    order_id = 1
    crypto_tx_internal_id = 101

    # Simulate fetching the crypto_transaction record
    # (crypto_tx_id, amount_expected, currency_expected, network)
    mock_cur.fetchone.return_value = (crypto_tx_internal_id, 100.0, 'TAIC', 'SimulatedTAIC')

    valid_tx_hash = "0x" + "a" * 64 # A valid looking hash

    response = client.post('/confirm-crypto-payment', json={
        'order_id': order_id,
        'transaction_hash': valid_tx_hash,
        'wallet_address': 'user_wallet_address_abc'
    })

    assert response.status_code == 200
    data = response.get_json()
    assert data['message'] == 'Crypto payment confirmed (Simulated).'
    assert data['orderId'] == order_id
    assert data['status'] == 'confirmed'

    # Verify DB calls
    mock_cur.execute.assert_any_call(
        "SELECT id, amount_expected, currency_expected, network FROM crypto_transactions WHERE order_id = %s AND status = 'pending_user_action'", (order_id,)
    )
    mock_cur.execute.assert_any_call(
        "UPDATE orders SET status = %s WHERE id = %s",
        ('paid', order_id)
    )

    found_crypto_update = False
    expected_confirmation_data = {'simulated_verification': True, 'hash_provided': valid_tx_hash}
    for call_args in mock_cur.execute.call_args_list:
        args, _ = call_args
        if "UPDATE crypto_transactions" in args[0]:
            assert args[1][0] == valid_tx_hash # transaction_hash
            assert args[1][1] == 'user_wallet_address_abc' # wallet_address
            assert args[1][2] == 'confirmed' # status
            assert args[1][3] == 100.0 # amount_received
            assert args[1][4].adapted == expected_confirmation_data # confirmation_data
            assert args[1][5] == crypto_tx_internal_id # id
            found_crypto_update = True
            break
    assert found_crypto_update, "Call to update crypto_transactions not found or args mismatch"

    assert mock_conn.commit.call_count == 1

def test_confirm_crypto_payment_failed_simulated_verification(client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection
    order_id = 2
    crypto_tx_internal_id = 102

    mock_cur.fetchone.return_value = (crypto_tx_internal_id, 50.0, 'TAIC', 'SimulatedTAIC')

    invalid_tx_hash = "invalid_hash_format"

    response = client.post('/confirm-crypto-payment', json={
        'order_id': order_id,
        'transaction_hash': invalid_tx_hash,
        'wallet_address': 'user_wallet_address_def'
    })

    assert response.status_code == 400 # As per current app logic for failed verification
    data = response.get_json()
    assert 'Crypto payment verification failed (Simulated)' in data['error']
    assert data['orderId'] == order_id
    assert data['status'] == 'failed_verification'

    # Verify DB calls
    mock_cur.execute.assert_any_call(
        "UPDATE orders SET status = %s WHERE id = %s",
        ('failed_crypto', order_id)
    )

    found_crypto_update_failed = False
    expected_confirmation_data_failed = {'simulated_verification': True, 'hash_provided': invalid_tx_hash}
    for call_args in mock_cur.execute.call_args_list:
        args, _ = call_args
        if "UPDATE crypto_transactions" in args[0] and args[1][0] == invalid_tx_hash:
            assert args[1][1] == 'user_wallet_address_def' # wallet_address
            assert args[1][2] == 'failed_verification' # status
            assert args[1][3] == 50.0 # amount_received
            assert args[1][4].adapted == expected_confirmation_data_failed # confirmation_data
            assert args[1][5] == crypto_tx_internal_id # id
            found_crypto_update_failed = True
            break
    assert found_crypto_update_failed, "Call to update crypto_transactions (failed case) not found or args mismatch"

    assert mock_conn.commit.call_count == 1

def test_confirm_crypto_payment_no_pending_transaction(client, mock_db_connection):
    mock_conn, mock_cur = mock_db_connection
    mock_cur.fetchone.return_value = None # Simulate no pending transaction found

    response = client.post('/confirm-crypto-payment', json={
        'order_id': 999, # Non-existent or already processed
        'transaction_hash': "0x" + "b" * 64,
        'wallet_address': 'user_wallet_xyz'
    })

    assert response.status_code == 404
    data = response.get_json()
    assert 'No pending crypto transaction found' in data['error']
    mock_conn.commit.assert_not_called() # No commit should happen

def test_confirm_crypto_payment_missing_data(client):
    response = client.post('/confirm-crypto-payment', json={'order_id': 1})
    assert response.status_code == 400
    data = response.get_json()
    assert 'Missing order_id, transaction_hash, or wallet_address' in data['error']
