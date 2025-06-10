import logging
from fastapi import APIRouter, HTTPException, status

from app.models.auth_models import UserRegisterSchema, MerchantRegisterSchema, RegistrationResponse
from app.email_utils import send_shopper_welcome_email, send_merchant_welcome_email

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Authentication (Placeholder)"],
    # prefix will be set in main.py, e.g., /api/auth
)

@router.post("/placeholder-register-shopper", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def placeholder_register_shopper(input_data: UserRegisterSchema):
    """
    Simulates shopper registration and sends a welcome email.
    **Note:** This endpoint does not actually create or save user data.
    """
    logger.info(f"Simulating shopper registration for email: {input_data.email}")
    logger.info(f"Shopper details: Full Name - {input_data.full_name}")

    # Simulate successful user creation in DB
    user_created_successfully = True # Assume success for placeholder

    if user_created_successfully:
        try:
            email_sent = await send_shopper_welcome_email(
                to_email=input_data.email,
                user_name=input_data.full_name
            )
            if email_sent:
                logger.info(f"Shopper welcome email simulation successful for: {input_data.email}")
                return RegistrationResponse(
                    message="Shopper registration simulated. Welcome email sent (simulated).",
                    user_email=input_data.email
                )
            else:
                logger.warning(f"Shopper welcome email simulation reported failure for: {input_data.email}")
                # Still return success for registration, but indicate email issue if needed by design
                # For now, we assume send_email_async always returns True or doesn't raise critical errors
                return RegistrationResponse(
                    message="Shopper registration simulated. Welcome email sending reported an issue (simulated).",
                    user_email=input_data.email
                )
        except Exception as e:
            logger.error(f"Failed to send shopper welcome email to {input_data.email}: {str(e)}")
            # Depending on policy, you might still consider registration successful
            # For this placeholder, we'll indicate registration was okay but email failed.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"User registration simulated, but failed to send welcome email: {str(e)}"
            ) # Or return a specific response indicating partial success.
            # For now, let's return a success but with a message that email failed.
            # return RegistrationResponse(
            #     message=f"Shopper registration simulated, but welcome email failed: {str(e)}",
            #     user_email=input_data.email
            # )


    # This part would be reached if user_created_successfully was False
    # raise HTTPException(
    #     status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #     detail="User registration simulation failed before email step."
    # )
    # Since it's a placeholder, we assume DB part is fine.

@router.post("/placeholder-register-merchant", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def placeholder_register_merchant(input_data: MerchantRegisterSchema):
    """
    Simulates merchant registration and sends a welcome email.
    **Note:** This endpoint does not actually create or save merchant data.
    """
    logger.info(f"Simulating merchant registration for email: {input_data.email}")
    logger.info(f"Merchant details: Business Name - {input_data.business_name}")

    # Simulate successful merchant creation in DB
    merchant_created_successfully = True # Assume success for placeholder

    if merchant_created_successfully:
        try:
            email_sent = await send_merchant_welcome_email(
                to_email=input_data.email,
                merchant_name=input_data.business_name
            )
            if email_sent:
                logger.info(f"Merchant welcome email simulation successful for: {input_data.email}")
                return RegistrationResponse(
                    message="Merchant registration simulated. Welcome email sent (simulated).",
                    merchant_email=input_data.email
                )
            else:
                logger.warning(f"Merchant welcome email simulation reported failure for: {input_data.email}")
                return RegistrationResponse(
                    message="Merchant registration simulated. Welcome email sending reported an issue (simulated).",
                    merchant_email=input_data.email
                )
        except Exception as e:
            logger.error(f"Failed to send merchant welcome email to {input_data.email}: {str(e)}")
            # Similar to shopper, decide if registration itself should fail.
            # For now, let's return a success but with a message that email failed.
            # raise HTTPException(
            #     status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            #     detail=f"Merchant registration simulated, but failed to send welcome email: {str(e)}"
            # )
            return RegistrationResponse(
                message=f"Merchant registration simulated, but welcome email failed: {str(e)}",
                merchant_email=input_data.email
            )

    # This part would be reached if merchant_created_successfully was False
    # raise HTTPException(
    #     status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #     detail="Merchant registration simulation failed before email step."
    # )
